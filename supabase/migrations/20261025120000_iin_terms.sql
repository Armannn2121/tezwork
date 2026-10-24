-- TezWork: ЖСН (жұмысшы), БСН (компания), келісімді қабылдау уақыты.
-- ЖСН жеке деректер болғандықтан, profiles-тан бөлек кестеде сақталады:
-- profiles кестесін бизнес (өз жұмысшыларының) оқи алады, ал private_profiles — тек иесі.

-- ЖСН/БСН бақылау цифрын тексеру (ҚР алгоритмі)
create or replace function public.is_valid_kz_id(v text)
returns boolean
language plpgsql
immutable
as $$
declare
  w1 int[] := array[1,2,3,4,5,6,7,8,9,10,11];
  w2 int[] := array[3,4,5,6,7,8,9,10,11,1,2];
  s int := 0;
  c int;
  i int;
begin
  if v is null or v !~ '^\d{12}$' then return false; end if;
  for i in 1..11 loop s := s + substr(v, i, 1)::int * w1[i]; end loop;
  c := s % 11;
  if c = 10 then
    s := 0;
    for i in 1..11 loop s := s + substr(v, i, 1)::int * w2[i]; end loop;
    c := s % 11;
    if c = 10 then return false; end if;
  end if;
  return c = substr(v, 12, 1)::int;
end;
$$;

-- ЖСН-нен туған күнді алу (7-цифр — ғасыр мен жыныс)
create or replace function public.kz_iin_birthdate(v text)
returns date
language plpgsql
immutable
as $$
declare
  c int;
  base int;
begin
  if not public.is_valid_kz_id(v) then return null; end if;
  c := substr(v, 7, 1)::int;
  base := case when c in (1, 2) then 1800 when c in (3, 4) then 1900 when c in (5, 6) then 2000 end;
  if base is null then return null; end if;
  return make_date(base + substr(v, 1, 2)::int, substr(v, 3, 2)::int, substr(v, 5, 2)::int);
exception when others then
  return null;
end;
$$;

create table if not exists public.private_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  iin text not null unique check (public.kz_iin_birthdate(iin) is not null),
  created_at timestamptz not null default now()
);

alter table public.private_profiles enable row level security;

drop policy if exists private_profiles_select on public.private_profiles;
create policy private_profiles_select on public.private_profiles
  for select to authenticated using (id = auth.uid());

-- ЖСН бір рет енгізіледі, өзгерту тек қолдау қызметі арқылы (update саясаты жоқ)
drop policy if exists private_profiles_insert on public.private_profiles;
create policy private_profiles_insert on public.private_profiles
  for insert to authenticated with check (id = auth.uid());

revoke all on public.private_profiles from anon;
grant select, insert on public.private_profiles to authenticated;

alter table public.profiles
  add column if not exists company_bin text,
  add column if not exists terms_accepted_at timestamptz;

alter table public.profiles drop constraint if exists profiles_company_bin_check;
alter table public.profiles add constraint profiles_company_bin_check
  check (company_bin is null or public.is_valid_kz_id(company_bin));

-- Жазылу: ЖСН міндетті және 16 жастан (ҚР Еңбек кодексі)
create or replace function public.apply_to_shift(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare s shifts; taken int; n int; bd date;
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
  select count(*) into taken from applications where shift_id = p_shift_id and status <> 'cancelled';
  if taken >= s.spots then raise exception 'Бос орын қалмады'; end if;

  insert into applications (shift_id, worker_id) values (p_shift_id, auth.uid())
  on conflict (shift_id, worker_id) do update set status = 'confirmed'
    where applications.status = 'cancelled';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Сіз бұл ауысымға жазылып қойғансыз'; end if;
end;
$$;
