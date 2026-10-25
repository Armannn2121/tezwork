-- TezWork: рөлді ауыстыру, төлем әдістері (карта/IBAN), әмиян (ТЕСТ РЕЖИМІ), ауысым сипаттамасы.
--
-- ⚠ Әмиян тест режимінде: толтыру мен шығару нақты ақша аудармайды, тек жазба жасайды.
--   Нақты төлем үшін провайдер (Kaspi / Halyk ePay / CloudPayments) қосылып,
--   wallet_topup / wallet_withdraw соның webhook-ы арқылы растайтын болады.
-- Картаның толық нөмірі ешқашан сақталмайды — тек соңғы 4 цифры (PCI DSS).

-- ───────── Рөлді ауыстыру ─────────
create or replace function public.switch_role(p_role public.user_role, p_company_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
      where a.worker_id = auth.uid() and a.status in ('confirmed', 'checked_in') and s.ends_at > now()
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
revoke all on function public.switch_role(public.user_role, text) from public, anon;
grant execute on function public.switch_role(public.user_role, text) to authenticated;

-- ───────── Ауысым сипаттамасы ─────────
alter table public.shifts add column if not exists description text;
alter table public.shifts drop constraint if exists shifts_description_check;
alter table public.shifts add constraint shifts_description_check
  check (description is null or length(description) <= 1000);

-- ───────── Төлем әдістері ─────────
-- KZ IBAN: KZ + 2 бақылау цифры + 16 таңба, mod-97 тексерісі
create or replace function public.is_valid_kz_iban(v text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text;
  r int := 0;
  ch text;
  n text;
  i int;
  j int;
begin
  if v is null or v !~ '^KZ\d{2}[0-9A-Z]{16}$' then return false; end if;
  s := substr(v, 5) || substr(v, 1, 4);
  for i in 1..length(s) loop
    ch := substr(s, i, 1);
    n := case when ch ~ '\d' then ch else (ascii(ch) - 55)::text end;
    for j in 1..length(n) loop
      r := (r * 10 + substr(n, j, 1)::int) % 97;
    end loop;
  end loop;
  return r = 1;
end;
$$;

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('card', 'iban')),
  bank text not null check (length(bank) between 2 and 60),
  holder text not null check (length(holder) between 2 and 80),
  card_last4 text check (card_last4 ~ '^\d{4}$'),
  card_brand text check (card_brand in ('visa', 'mastercard', 'other')),
  iban text check (iban is null or public.is_valid_kz_iban(iban)),
  created_at timestamptz not null default now(),
  check (
    (kind = 'card' and card_last4 is not null and iban is null) or
    (kind = 'iban' and iban is not null and card_last4 is null)
  )
);
create index if not exists payment_methods_user_idx on public.payment_methods(user_id);

alter table public.payment_methods enable row level security;
drop policy if exists payment_methods_select on public.payment_methods;
create policy payment_methods_select on public.payment_methods for select to authenticated using (user_id = auth.uid());
drop policy if exists payment_methods_insert on public.payment_methods;
create policy payment_methods_insert on public.payment_methods for insert to authenticated with check (user_id = auth.uid());
drop policy if exists payment_methods_delete on public.payment_methods;
create policy payment_methods_delete on public.payment_methods for delete to authenticated using (user_id = auth.uid());
revoke all on public.payment_methods from anon, authenticated;
grant select, insert, delete on public.payment_methods to authenticated;

-- ───────── Әмиян ─────────
create table if not exists public.wallet_tx (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null check (amount <> 0),            -- + кіріс, − шығыс
  kind text not null check (kind in ('topup', 'withdraw', 'earning', 'payment')),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  application_id uuid references public.applications(id) on delete set null,
  method_id uuid references public.payment_methods(id) on delete set null,
  is_test boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx on public.wallet_tx(user_id, created_at desc);

alter table public.wallet_tx enable row level security;
drop policy if exists wallet_tx_select on public.wallet_tx;
create policy wallet_tx_select on public.wallet_tx for select to authenticated using (user_id = auth.uid());
revoke all on public.wallet_tx from anon, authenticated;
grant select on public.wallet_tx to authenticated;
-- Жазу тек төмендегі функциялар арқылы

create or replace function public.wallet_balance(uid uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(sum(amount), 0)::int from public.wallet_tx where user_id = uid and status <> 'failed' $$;
revoke all on function public.wallet_balance(uuid) from public, anon, authenticated;

create or replace function public.my_wallet()
returns table(balance int, earned int, spent int, topped_up int, withdrawn int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(amount), 0)::int,
    coalesce(sum(amount) filter (where kind = 'earning'), 0)::int,
    coalesce(-sum(amount) filter (where kind = 'payment'), 0)::int,
    coalesce(sum(amount) filter (where kind = 'topup'), 0)::int,
    coalesce(-sum(amount) filter (where kind = 'withdraw'), 0)::int
  from public.wallet_tx
  where user_id = auth.uid() and status <> 'failed'
$$;
revoke all on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;

create or replace function public.wallet_topup(p_amount int, p_method_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'business' then
    raise exception 'Әмиянды тек жұмыс беруші толтыра алады';
  end if;
  if p_amount is null or p_amount < 1000 or p_amount > 5000000 then
    raise exception 'Сома 1 000 – 5 000 000 ₸ аралығында болуы керек';
  end if;
  if not exists (select 1 from public.payment_methods m where m.id = p_method_id and m.user_id = auth.uid() and m.kind = 'card') then
    raise exception 'Карта табылмады';
  end if;
  insert into public.wallet_tx (user_id, amount, kind, status, method_id)
  values (auth.uid(), p_amount, 'topup', 'completed', p_method_id);
end;
$$;
revoke all on function public.wallet_topup(int, uuid) from public, anon;
grant execute on function public.wallet_topup(int, uuid) to authenticated;

create or replace function public.wallet_withdraw(p_amount int, p_method_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount is null or p_amount < 1000 then
    raise exception 'Ең аз шығару сомасы — 1 000 ₸';
  end if;
  if not exists (select 1 from public.payment_methods m where m.id = p_method_id and m.user_id = auth.uid()) then
    raise exception 'Төлем әдісі табылмады';
  end if;
  -- Бір уақытта екі рет шығаруға жол бермейміз
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  if public.wallet_balance(auth.uid()) < p_amount then
    raise exception 'Әмиянда қаражат жеткіліксіз';
  end if;
  insert into public.wallet_tx (user_id, amount, kind, status, method_id)
  values (auth.uid(), -p_amount, 'withdraw', 'completed', p_method_id);
end;
$$;
revoke all on function public.wallet_withdraw(int, uuid) from public, anon;
grant execute on function public.wallet_withdraw(int, uuid) to authenticated;

-- «Аяқтады» белгіленгенде: жұмыс берушінің әмиянынан жұмысшыға ауысым төлемі аударылады
create or replace function public.set_application_status(p_application_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  -- Рұқсат етілген ауысулар: confirmed → checked_in → completed
  if not ((v_current = 'confirmed' and p_status = 'checked_in')
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
revoke all on function public.set_application_status(uuid, text) from public, anon;
grant execute on function public.set_application_status(uuid, text) to authenticated;

-- ───────── RPC-лерге сипаттама қосу ─────────
drop function if exists public.list_open_shifts(text);
create function public.list_open_shifts(p_city text default null)
returns table(id uuid, title text, category text, city text, address text,
  starts_at timestamptz, ends_at timestamptz, pay_kzt int, spots int, spots_left int,
  company_name text, applied boolean, company_rating numeric, company_reviews int, description text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.id, s.title, s.category, s.city, s.address, s.starts_at, s.ends_at, s.pay_kzt, s.spots,
    greatest(s.spots - (select count(*) from applications a where a.shift_id = s.id and a.status <> 'cancelled'), 0)::int,
    p.company_name,
    exists (select 1 from applications a where a.shift_id = s.id and a.worker_id = auth.uid() and a.status <> 'cancelled'),
    rating_avg(s.business_id), rating_count(s.business_id),
    s.description
  from shifts s join profiles p on p.id = s.business_id
  where s.status = 'open' and s.starts_at > now() and (p_city is null or s.city = p_city)
  order by s.starts_at
$$;

drop function if exists public.my_applications();
create function public.my_applications()
returns table(application_id uuid, status text, shift_id uuid, title text, city text, address text,
  starts_at timestamptz, ends_at timestamptz, pay_kzt int, company_name text,
  category text, business_phone text, company_rating numeric, company_reviews int, my_stars int, description text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.id, a.status::text, s.id, s.title, s.city, s.address, s.starts_at, s.ends_at, s.pay_kzt, p.company_name,
    s.category,
    case when a.status <> 'cancelled' then user_contact_phone(s.business_id) end,
    rating_avg(s.business_id), rating_count(s.business_id),
    (select r.stars from ratings r where r.application_id = a.id and r.rater_id = auth.uid()),
    s.description
  from applications a join shifts s on s.id = a.shift_id join profiles p on p.id = s.business_id
  where a.worker_id = auth.uid()
  order by s.starts_at desc
$$;

drop function if exists public.my_business_shifts();
create function public.my_business_shifts()
returns table(id uuid, title text, city text, address text, starts_at timestamptz, ends_at timestamptz,
  pay_kzt int, spots int, status text, taken int, category text, description text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.id, s.title, s.city, s.address, s.starts_at, s.ends_at, s.pay_kzt, s.spots, s.status::text,
    (select count(*) from applications a where a.shift_id = s.id and a.status <> 'cancelled')::int,
    s.category, s.description
  from shifts s where s.business_id = auth.uid()
  order by s.starts_at desc
$$;

revoke all on function public.list_open_shifts(text) from public, anon;
revoke all on function public.my_applications() from public, anon;
revoke all on function public.my_business_shifts() from public, anon;
grant execute on function public.list_open_shifts(text) to authenticated;
grant execute on function public.my_applications() to authenticated;
grant execute on function public.my_business_shifts() to authenticated;

-- Бұрын жасалған кестелерге де тікелей жазуды жабамыз (тек RPC арқылы)
revoke insert, update, delete on public.ratings from authenticated;
