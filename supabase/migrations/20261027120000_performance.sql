-- TezWork: жылдамдық пен тұтастық.
--  • Сыртқы кілттерге индекстер (Supabase кеңесі: unindexed_foreign_keys)
--  • RLS-те auth.uid() бір рет есептеледі: (select auth.uid()) (кеңес: auth_rls_initplan)
--  • list_open_shifts: әр жолға функция шақырудың орнына бір реттік агрегаттар
--  • get_shift: бір ауысымның толық көрінісі бір сұраныспен (бұрын бүкіл тізімдер жүктелетін)
--  • Ауысым жабылғанда расталған жазылымдар да жабылады
--  • Жұмыс беруші ауысымның тек күйін өзгерте алады (ақы/уақытты жазылғаннан кейін өзгерту мүмкін емес)

-- ───────── Индекстер ─────────
create index if not exists shifts_business_starts_idx on public.shifts (business_id, starts_at desc);
create index if not exists shifts_open_city_starts_idx on public.shifts (city, starts_at) where status = 'open';
create index if not exists ratings_rater_idx on public.ratings (rater_id);
create index if not exists wallet_tx_application_idx on public.wallet_tx (application_id);
create index if not exists wallet_tx_method_idx on public.wallet_tx (method_id);

-- ───────── RLS: auth.uid() бір рет ─────────
alter policy applications_select on public.applications using (worker_id = (select auth.uid()));

alter policy payment_methods_select on public.payment_methods using (user_id = (select auth.uid()));
alter policy payment_methods_insert on public.payment_methods with check (user_id = (select auth.uid()));
alter policy payment_methods_delete on public.payment_methods using (user_id = (select auth.uid()));

alter policy private_profiles_select on public.private_profiles using (id = (select auth.uid()));
alter policy private_profiles_insert on public.private_profiles with check (id = (select auth.uid()));

alter policy profiles_select on public.profiles using (id = (select auth.uid()) or public.is_my_applicant(id));
alter policy profiles_insert on public.profiles with check (id = (select auth.uid()));
alter policy profiles_update on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select public.my_role()));

alter policy ratings_select on public.ratings
  using (rater_id = (select auth.uid()) or ratee_id = (select auth.uid()));

alter policy shifts_select on public.shifts using (business_id = (select auth.uid()));
-- Жаңа ауысым тек ашық күйде және болашақта
alter policy shifts_insert on public.shifts
  with check (business_id = (select auth.uid()) and (select public.my_role()) = 'business'
    and status = 'open' and starts_at > now());
-- Тек жабуға болады (қайта ашуға емес)
alter policy shifts_update on public.shifts
  using (business_id = (select auth.uid()))
  with check (business_id = (select auth.uid()) and status <> 'open');

alter policy wallet_tx_select on public.wallet_tx using (user_id = (select auth.uid()));

-- ───────── Ауысымды өзгерту: тек күйі ─────────
-- Әйтпесе жұмыс беруші жұмысшылар жазылғаннан кейін ақыны азайтып, «Аяқтады» кезінде аз төлей алады
revoke update on public.shifts from authenticated;
grant update (status) on public.shifts to authenticated;

-- Кірмеген (anon) пайдаланушыға кестелер керек емес — RLS онсыз да жабады, бірақ құқықтарды да алып тастаймыз
revoke all on public.applications, public.profiles, public.shifts from anon;

-- Event trigger функциясын API арқылы шақыруға болмайды
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ───────── Ауысым жабылғанда — расталған жазылымдар да жабылады ─────────
create or replace function public.cancel_shift_applications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'open' and old.status = 'open' then
    update public.applications set status = 'cancelled'
    where shift_id = new.id and status = 'confirmed';
  end if;
  return new;
end;
$$;
revoke execute on function public.cancel_shift_applications() from public, anon, authenticated;

drop trigger if exists shifts_cancel_applications on public.shifts;
create trigger shifts_cancel_applications
  after update of status on public.shifts
  for each row execute function public.cancel_shift_applications();

-- Бұрын жабылған ауысымдардағы «расталған» жазылымдарды да түзетеміз
update public.applications a set status = 'cancelled'
from public.shifts s
where s.id = a.shift_id and s.status <> 'open' and a.status = 'confirmed';

-- ───────── Ашық ауысымдар: бір өтуде ─────────
create or replace function public.list_open_shifts(p_city text default null)
returns table(id uuid, title text, category text, city text, address text,
  starts_at timestamptz, ends_at timestamptz, pay_kzt int, spots int, spots_left int,
  company_name text, applied boolean, company_rating numeric, company_reviews int, description text)
language sql
stable
security definer
set search_path = ''
as $$
  with cand as (
    select s.* from public.shifts s
    where s.status = 'open' and s.starts_at > now() and (p_city is null or s.city = p_city)
    order by s.starts_at
    limit 300
  ),
  apps as (
    select a.shift_id,
      count(*) filter (where a.status <> 'cancelled') as taken,
      bool_or(a.worker_id = (select auth.uid()) and a.status <> 'cancelled') as mine
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
  order by o.starts_at
$$;

-- ───────── Бір ауысым: толық көрініс ─────────
-- Иесіне — өз ауысымы; жұмысшыға — ашық ауысым немесе өзі жазылған ауысым
create or replace function public.get_shift(p_id uuid)
returns table(id uuid, title text, category text, city text, address text,
  starts_at timestamptz, ends_at timestamptz, pay_kzt int, spots int, spots_left int, taken int,
  status text, description text, company_name text, company_rating numeric, company_reviews int,
  applied boolean, application_id uuid, application_status text, business_phone text, my_stars int)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, s.category, s.city, s.address, s.starts_at, s.ends_at, s.pay_kzt, s.spots,
    greatest(s.spots - t.n, 0)::int, t.n::int,
    s.status::text, s.description, p.company_name, r.avg, r.cnt,
    coalesce(a.status <> 'cancelled', false), a.id, a.status::text,
    case when a.status <> 'cancelled' then public.user_contact_phone(s.business_id) end,
    (select rt.stars from public.ratings rt where rt.application_id = a.id and rt.rater_id = (select auth.uid()))
  from public.shifts s
  join public.profiles p on p.id = s.business_id
  cross join lateral (
    select count(*) as n from public.applications x where x.shift_id = s.id and x.status <> 'cancelled'
  ) t
  cross join lateral (
    select round(avg(x.stars)::numeric, 1) as avg, count(*)::int as cnt from public.ratings x where x.ratee_id = s.business_id
  ) r
  left join public.applications a on a.shift_id = s.id and a.worker_id = (select auth.uid())
  where s.id = p_id
    and (s.business_id = (select auth.uid()) or a.id is not null or s.status = 'open')
$$;
revoke all on function public.get_shift(uuid) from public, anon;
grant execute on function public.get_shift(uuid) to authenticated;
