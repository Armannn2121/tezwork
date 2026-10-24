-- TezWork: байланыс нөмірлері және екі жақты рейтинг.
--  • Жұмыс беруші өз байланыс нөмірін қалдыра алады (profiles.contact_phone).
--  • Нөмірлер тек жазылғаннан кейін көрінеді: жұмысшы — жұмыс берушінің, жұмыс беруші — өз ауысымына жазылғандардың.
--  • Ауысым «Аяқталды» болғанда екі жақ бір-біріне 1–5 жұлдыз қояды (бір рет).

-- ───────── Байланыс ─────────
alter table public.profiles add column if not exists contact_phone text;
alter table public.profiles drop constraint if exists profiles_contact_phone_check;
alter table public.profiles add constraint profiles_contact_phone_check
  check (contact_phone is null or contact_phone ~ '^\+7\d{10}$');

-- Пайдаланушының байланыс нөмірі: өзі қалдырған нөмір, болмаса тіркелген нөмірі.
-- Тек басқа security definer функциялардың ішінде қолданылады — тікелей шақыруға болмайды.
create or replace function public.user_contact_phone(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.contact_phone, case when coalesce(u.phone, '') <> '' then '+' || u.phone end)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = uid
$$;
revoke all on function public.user_contact_phone(uuid) from public, anon, authenticated;

-- ───────── Рейтинг ─────────
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  rater_id uuid not null references public.profiles(id) on delete cascade,
  ratee_id uuid not null references public.profiles(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text check (comment is null or length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (application_id, rater_id)
);
create index if not exists ratings_ratee_idx on public.ratings(ratee_id);

alter table public.ratings enable row level security;
drop policy if exists ratings_select on public.ratings;
create policy ratings_select on public.ratings
  for select to authenticated using (rater_id = auth.uid() or ratee_id = auth.uid());
revoke all on public.ratings from anon;
grant select on public.ratings to authenticated;
-- Жазу тек rate_application арқылы

create or replace function public.rating_avg(uid uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$ select round(avg(stars)::numeric, 1) from public.ratings where ratee_id = uid $$;

create or replace function public.rating_count(uid uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$ select count(*)::int from public.ratings where ratee_id = uid $$;

revoke all on function public.rating_avg(uuid) from public, anon;
revoke all on function public.rating_count(uuid) from public, anon;
grant execute on function public.rating_avg(uuid) to authenticated;
grant execute on function public.rating_count(uuid) to authenticated;

create or replace function public.rate_application(p_application_id uuid, p_stars int, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_worker uuid;
  v_business uuid;
  v_ratee uuid;
begin
  select ap.status::text, ap.worker_id, s.business_id
    into v_status, v_worker, v_business
  from public.applications ap
  join public.shifts s on s.id = ap.shift_id
  where ap.id = p_application_id;

  if not found then raise exception 'Жазылым табылмады'; end if;
  if v_status <> 'completed' then raise exception 'Тек аяқталған ауысымға баға беруге болады'; end if;
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'Баға 1-ден 5-ке дейін болуы керек'; end if;

  if auth.uid() = v_worker then v_ratee := v_business;
  elsif auth.uid() = v_business then v_ratee := v_worker;
  else raise exception 'Бұл ауысым сізге тиесілі емес' using errcode = '42501';
  end if;

  insert into public.ratings (application_id, rater_id, ratee_id, stars, comment)
  values (p_application_id, auth.uid(), v_ratee, p_stars, nullif(btrim(coalesce(p_comment, '')), ''));
exception when unique_violation then
  raise exception 'Сіз бұл ауысымға баға беріп қойғансыз';
end;
$$;
revoke all on function public.rate_application(uuid, int, text) from public, anon;
grant execute on function public.rate_application(uuid, int, text) to authenticated;

-- Өз бағам (профиль үшін)
create or replace function public.my_rating()
returns table(avg numeric, reviews int)
language sql
stable
security definer
set search_path = ''
as $$ select public.rating_avg(auth.uid()), public.rating_count(auth.uid()) $$;
revoke all on function public.my_rating() from public, anon;
grant execute on function public.my_rating() to authenticated;

-- ───────── RPC-лерді жаңарту (қайтаратын бағандар өзгерді → drop + create) ─────────

drop function if exists public.list_open_shifts(text);
create function public.list_open_shifts(p_city text default null)
returns table(id uuid, title text, category text, city text, address text,
  starts_at timestamptz, ends_at timestamptz, pay_kzt int, spots int, spots_left int,
  company_name text, applied boolean, company_rating numeric, company_reviews int)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.id, s.title, s.category, s.city, s.address, s.starts_at, s.ends_at, s.pay_kzt, s.spots,
    greatest(s.spots - (select count(*) from applications a where a.shift_id = s.id and a.status <> 'cancelled'), 0)::int,
    p.company_name,
    exists (select 1 from applications a where a.shift_id = s.id and a.worker_id = auth.uid() and a.status <> 'cancelled'),
    rating_avg(s.business_id), rating_count(s.business_id)
  from shifts s join profiles p on p.id = s.business_id
  where s.status = 'open' and s.starts_at > now() and (p_city is null or s.city = p_city)
  order by s.starts_at
$$;

drop function if exists public.my_applications();
create function public.my_applications()
returns table(application_id uuid, status text, shift_id uuid, title text, city text, address text,
  starts_at timestamptz, ends_at timestamptz, pay_kzt int, company_name text,
  category text, business_phone text, company_rating numeric, company_reviews int, my_stars int)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.id, a.status::text, s.id, s.title, s.city, s.address, s.starts_at, s.ends_at, s.pay_kzt, p.company_name,
    s.category,
    case when a.status <> 'cancelled' then user_contact_phone(s.business_id) end,
    rating_avg(s.business_id), rating_count(s.business_id),
    (select r.stars from ratings r where r.application_id = a.id and r.rater_id = auth.uid())
  from applications a join shifts s on s.id = a.shift_id join profiles p on p.id = s.business_id
  where a.worker_id = auth.uid()
  order by s.starts_at desc
$$;

drop function if exists public.shift_applicants(uuid);
create function public.shift_applicants(p_shift_id uuid)
returns table(application_id uuid, full_name text, status text,
  worker_phone text, worker_rating numeric, worker_reviews int, my_stars int)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.id, p.full_name, a.status::text,
    user_contact_phone(a.worker_id),
    rating_avg(a.worker_id), rating_count(a.worker_id),
    (select r.stars from ratings r where r.application_id = a.id and r.rater_id = auth.uid())
  from applications a
  join profiles p on p.id = a.worker_id
  join shifts s on s.id = a.shift_id
  where a.shift_id = p_shift_id and s.business_id = auth.uid() and a.status <> 'cancelled'
  order by a.created_at
$$;

drop function if exists public.my_business_shifts();
create function public.my_business_shifts()
returns table(id uuid, title text, city text, address text, starts_at timestamptz, ends_at timestamptz,
  pay_kzt int, spots int, status text, taken int, category text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.id, s.title, s.city, s.address, s.starts_at, s.ends_at, s.pay_kzt, s.spots, s.status::text,
    (select count(*) from applications a where a.shift_id = s.id and a.status <> 'cancelled')::int,
    s.category
  from shifts s where s.business_id = auth.uid()
  order by s.starts_at desc
$$;

revoke all on function public.list_open_shifts(text) from public, anon;
revoke all on function public.my_applications() from public, anon;
revoke all on function public.shift_applicants(uuid) from public, anon;
revoke all on function public.my_business_shifts() from public, anon;
grant execute on function public.list_open_shifts(text) to authenticated;
grant execute on function public.my_applications() to authenticated;
grant execute on function public.shift_applicants(uuid) to authenticated;
grant execute on function public.my_business_shifts() to authenticated;
