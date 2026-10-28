-- Өтінімді растау ағыны:
--   жұмысшы өтінім береді (pending) → жұмыс беруші қабылдайды (confirmed) немесе бас тартады (rejected)
--   → орын толса, қалған өтінімдер автоматты rejected, ауысым лентадан жоғалады
--   → ауысым біткенде «Аяқтады» (completed) → төлем жұмысшының әмиянына.
-- Орын тек қабылданған өтінімдерге (confirmed/checked_in/completed) есептеледі.

alter table public.applications alter column status set default 'pending';

-- Орын алып тұрған өтінімдер саны
create or replace function public.shift_taken(p_shift_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.applications
  where shift_id = p_shift_id and status in ('confirmed', 'checked_in', 'completed')
$$;
revoke all on function public.shift_taken(uuid) from public, anon;
grant execute on function public.shift_taken(uuid) to authenticated;

create or replace function public.apply_to_shift(p_shift_id uuid)
returns void language plpgsql security definer set search_path = 'public' as $$
declare s shifts; n int; bd date;
begin
  if my_role() is distinct from 'worker' then
    raise exception 'Тек орындаушы жазыла алады';
  end if;

  select kz_iin_birthdate(iin) into bd from private_profiles where id = auth.uid();
  if bd is null then raise exception 'ЖСН көрсетілмеген'; end if;
  if bd > (current_date - interval '16 years') then
    raise exception 'Ауысымға 16 жастан бастап жазылуға болады';
  end if;

  select * into s from shifts where id = p_shift_id for update;
  if not found or s.status <> 'open' then raise exception 'Ауысым қолжетімсіз'; end if;
  if s.starts_at <= now() then raise exception 'Ауысым басталып кеткен'; end if;
  if shift_taken(p_shift_id) >= s.spots then raise exception 'Бос орын қалмады'; end if;

  insert into applications (shift_id, worker_id, status) values (p_shift_id, auth.uid(), 'pending')
  on conflict (shift_id, worker_id) do update set status = 'pending', created_at = now()
    where applications.status = 'cancelled';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Сіз бұл ауысымға өтінім беріп қойғансыз'; end if;
end;
$$;

-- Жұмыс беруші өтінімді қабылдайды немесе бас тартады
create or replace function public.decide_application(p_application_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = 'public' as $$
declare a applications; s shifts;
begin
  select * into a from applications where id = p_application_id;
  if not found then raise exception 'Өтінім табылмады'; end if;

  select * into s from shifts where id = a.shift_id for update;
  if s.business_id is distinct from auth.uid() then
    raise exception 'Бұл ауысым сізге тиесілі емес' using errcode = '42501';
  end if;

  select * into a from applications where id = p_application_id for update;
  if a.status <> 'pending' then raise exception 'Өтінім бұдан бұрын қаралған'; end if;

  if not p_accept then
    update applications set status = 'rejected' where id = p_application_id;
    return;
  end if;

  if s.status <> 'open' then raise exception 'Ауысым жабық'; end if;
  if s.ends_at <= now() then raise exception 'Ауысым аяқталған'; end if;
  if shift_taken(s.id) >= s.spots then raise exception 'Бос орын қалмады'; end if;

  update applications set status = 'confirmed' where id = p_application_id;

  -- Орын толды: қалған өтінімдерге бас тартылады
  if shift_taken(s.id) >= s.spots then
    update applications set status = 'rejected' where shift_id = s.id and status = 'pending';
  end if;
end;
$$;
revoke all on function public.decide_application(uuid, boolean) from public, anon;
grant execute on function public.decide_application(uuid, boolean) to authenticated;

create or replace function public.cancel_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = 'public' as $$
declare n int;
begin
  update applications a set status = 'cancelled'
  from shifts s
  where a.id = p_application_id and a.worker_id = auth.uid()
    and a.status in ('pending', 'confirmed') and s.id = a.shift_id and s.starts_at > now();
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Бас тарту мүмкін емес'; end if;
end $$;

-- Аяқталды деп бірден белгілеуге болады (Келді белгісіз)
create or replace function public.set_application_status(p_application_id uuid, p_status text)
returns void language plpgsql security definer set search_path = 'public' as $$
declare
  v_current text;
  v_owner uuid;
  v_worker uuid;
  v_starts timestamptz;
  v_pay int;
begin
  select a.status, s.business_id, a.worker_id, s.starts_at, s.pay_kzt
    into v_current, v_owner, v_worker, v_starts, v_pay
  from applications a
  join shifts s on s.id = a.shift_id
  where a.id = p_application_id
  for update of a;

  if not found then
    raise exception 'Жазылым табылмады';
  end if;
  if v_owner is distinct from auth.uid() then
    raise exception 'Бұл ауысым сізге тиесілі емес' using errcode = '42501';
  end if;
  if v_starts > now() then
    raise exception 'Ауысым әлі басталған жоқ';
  end if;

  if not ((v_current = 'confirmed' and p_status in ('checked_in', 'completed'))
       or (v_current = 'checked_in' and p_status = 'completed')) then
    raise exception 'Күйді % → % ауыстыруға болмайды', v_current, p_status;
  end if;

  if p_status = 'completed' then
    perform pg_advisory_xact_lock(hashtext(v_owner::text));
    if wallet_balance(v_owner) < v_pay then
      raise exception 'Әмиянда қаражат жеткіліксіз: ауысым төлемі % ₸', v_pay;
    end if;
    insert into wallet_tx (user_id, amount, kind, status, application_id) values
      (v_owner, -v_pay, 'payment', 'completed', p_application_id),
      (v_worker, v_pay, 'earning', 'completed', p_application_id);
  end if;

  update applications set status = p_status::application_status where id = p_application_id;
end;
$$;

-- Лента: толған ауысымдар көрінбейді
create or replace function public.list_open_shifts(p_city text default null)
returns table(id uuid, title text, category text, city text, address text, starts_at timestamptz, ends_at timestamptz, pay_kzt integer, spots integer, spots_left integer, company_name text, applied boolean, company_rating numeric, company_reviews integer, description text)
language sql stable security definer set search_path = '' as $$
  with cand as (
    select s.* from public.shifts s
    where s.status = 'open' and s.starts_at > now() and (p_city is null or s.city = p_city)
    order by s.starts_at
    limit 300
  ),
  apps as (
    select a.shift_id,
      count(*) filter (where a.status in ('confirmed', 'checked_in', 'completed')) as taken,
      bool_or(a.worker_id = (select auth.uid()) and a.status not in ('cancelled', 'rejected')) as mine
    from public.applications a
    where a.shift_id in (select c.id from cand c)
    group by a.shift_id
  ),
  rt as (
    select r.ratee_id, round(avg(r.stars)::numeric, 1) as avg, count(*)::int as cnt
    from public.ratings r
    where r.ratee_id in (select c.business_id from cand c)
    group by r.ratee_id
  )
  select o.id, o.title, o.category, o.city, o.address, o.starts_at, o.ends_at, o.pay_kzt, o.spots,
    greatest(o.spots - coalesce(ap.taken, 0), 0)::int,
    p.company_name,
    coalesce(ap.mine, false),
    rt.avg, coalesce(rt.cnt, 0),
    o.description
  from cand o
  join public.profiles p on p.id = o.business_id
  left join apps ap on ap.shift_id = o.id
  left join rt on rt.ratee_id = o.business_id
  where coalesce(ap.taken, 0) < o.spots or coalesce(ap.mine, false)
  order by o.starts_at
$$;

create or replace function public.get_shift(p_id uuid)
returns table(id uuid, title text, category text, city text, address text, starts_at timestamptz, ends_at timestamptz, pay_kzt integer, spots integer, spots_left integer, taken integer, status text, description text, company_name text, company_rating numeric, company_reviews integer, applied boolean, application_id uuid, application_status text, business_phone text, my_stars integer)
language sql stable security definer set search_path = '' as $$
  select s.id, s.title, s.category, s.city, s.address, s.starts_at, s.ends_at, s.pay_kzt, s.spots,
    greatest(s.spots - t.n, 0)::int, t.n::int,
    s.status::text, s.description, p.company_name, r.avg, r.cnt,
    coalesce(a.status not in ('cancelled', 'rejected'), false), a.id, a.status::text,
    case when a.status in ('confirmed', 'checked_in', 'completed') then public.user_contact_phone(s.business_id) end,
    (select rt.stars from public.ratings rt where rt.application_id = a.id and rt.rater_id = (select auth.uid()))
  from public.shifts s
  join public.profiles p on p.id = s.business_id
  cross join lateral (
    select count(*) as n from public.applications x
    where x.shift_id = s.id and x.status in ('confirmed', 'checked_in', 'completed')
  ) t
  cross join lateral (
    select round(avg(x.stars)::numeric, 1) as avg, count(*)::int as cnt from public.ratings x where x.ratee_id = s.business_id
  ) r
  left join public.applications a on a.shift_id = s.id and a.worker_id = (select auth.uid())
  where s.id = p_id
    and (s.business_id = (select auth.uid()) or a.id is not null or s.status = 'open')
$$;

create or replace function public.my_applications()
returns table(application_id uuid, status text, shift_id uuid, title text, city text, address text, starts_at timestamptz, ends_at timestamptz, pay_kzt integer, company_name text, category text, business_phone text, company_rating numeric, company_reviews integer, my_stars integer, description text)
language sql stable security definer set search_path = 'public' as $$
  select a.id, a.status::text, s.id, s.title, s.city, s.address, s.starts_at, s.ends_at, s.pay_kzt, p.company_name,
    s.category,
    case when a.status in ('confirmed', 'checked_in', 'completed') then user_contact_phone(s.business_id) end,
    rating_avg(s.business_id), rating_count(s.business_id),
    (select r.stars from ratings r where r.application_id = a.id and r.rater_id = auth.uid()),
    s.description
  from applications a join shifts s on s.id = a.shift_id join profiles p on p.id = s.business_id
  where a.worker_id = auth.uid()
  order by s.starts_at desc
$$;

-- Жұмыс берушіге жұмысшының нөмірі бірден көрінеді (pending кезінде де)
create or replace function public.shift_applicants(p_shift_id uuid)
returns table(application_id uuid, full_name text, status text, worker_phone text, worker_rating numeric, worker_reviews integer, my_stars integer)
language sql stable security definer set search_path = 'public' as $$
  select a.id, p.full_name, a.status::text,
    user_contact_phone(a.worker_id),
    rating_avg(a.worker_id), rating_count(a.worker_id),
    (select r.stars from ratings r where r.application_id = a.id and r.rater_id = auth.uid())
  from applications a
  join profiles p on p.id = a.worker_id
  join shifts s on s.id = a.shift_id
  where a.shift_id = p_shift_id and s.business_id = auth.uid() and a.status not in ('cancelled', 'rejected')
  order by (a.status = 'pending'), a.created_at
$$;

drop function if exists public.my_business_shifts();
create function public.my_business_shifts()
returns table(id uuid, title text, city text, address text, starts_at timestamptz, ends_at timestamptz, pay_kzt integer, spots integer, status text, taken integer, pending integer, category text, description text)
language sql stable security definer set search_path = 'public' as $$
  select s.id, s.title, s.city, s.address, s.starts_at, s.ends_at, s.pay_kzt, s.spots, s.status::text,
    c.taken, c.pending, s.category, s.description
  from shifts s
  cross join lateral (
    select count(*) filter (where a.status in ('confirmed', 'checked_in', 'completed'))::int as taken,
      count(*) filter (where a.status = 'pending')::int as pending
    from applications a where a.shift_id = s.id
  ) c
  where s.business_id = auth.uid()
  order by s.starts_at desc
$$;
revoke all on function public.my_business_shifts() from public, anon;
grant execute on function public.my_business_shifts() to authenticated;

create or replace function public.cancel_shift_applications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'open' and old.status = 'open' then
    update public.applications set status = 'cancelled'
    where shift_id = new.id and status in ('pending', 'confirmed');
  end if;
  return new;
end;
$$;

create or replace function public.switch_role(p_role user_role, p_company_name text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_current public.user_role;
  v_company text;
  v_birth date;
begin
  select role, company_name into v_current, v_company from public.profiles where id = auth.uid();
  if not found then raise exception 'Профиль табылмады'; end if;
  if v_current = p_role then return; end if;

  if p_role = 'business' then
    select public.kz_iin_birthdate(iin) into v_birth from public.private_profiles where id = auth.uid();
    if v_birth is null then raise exception 'ЖСН көрсетілмеген'; end if;
    if v_birth > (current_date - interval '18 years') then
      raise exception 'Жұмыс беруші ретінде 18 жастан бастап тіркелуге болады';
    end if;
    v_company := coalesce(nullif(btrim(p_company_name), ''), v_company);
    if v_company is null or length(v_company) < 2 then raise exception 'Компания атауын жазыңыз'; end if;
    if exists (
      select 1 from public.applications a join public.shifts s on s.id = a.shift_id
      where a.worker_id = auth.uid() and a.status in ('pending', 'confirmed', 'checked_in') and s.ends_at > now()
    ) then
      raise exception 'Алдымен белсенді жазылымдарыңызды аяқтаңыз немесе бас тартыңыз';
    end if;
    update public.profiles set role = 'business', company_name = v_company where id = auth.uid();
  else
    if exists (select 1 from public.shifts where business_id = auth.uid() and status = 'open' and ends_at > now()) then
      raise exception 'Алдымен белсенді ауысымдарыңызды жабыңыз';
    end if;
    update public.profiles set role = 'worker' where id = auth.uid();
  end if;
end;
$$;
