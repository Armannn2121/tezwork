-- Жұмыс беруші ауысым жариялау үшін ЖСН көрсетіп, 18 жастан асқан болуы керек.
-- Тексеріс триггерде — қосымшаны айналып өтіп API арқылы жазса да жұмыс істейді.
-- (Жұмыс іздеушінің 16+ шектеуі apply_to_shift ішінде: 20261025120000_iin_terms.sql)

create or replace function public.check_employer_age()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  bd date;
begin
  select public.kz_iin_birthdate(pp.iin) into bd
  from public.private_profiles pp
  where pp.id = new.business_id;

  if bd is null then
    raise exception 'ЖСН көрсетілмеген';
  end if;
  if bd > (current_date - interval '18 years') then
    raise exception 'Ауысымды 18 жастан бастап жариялауға болады';
  end if;
  return new;
end;
$$;

drop trigger if exists shifts_employer_age on public.shifts;
create trigger shifts_employer_age
  before insert on public.shifts
  for each row execute function public.check_employer_age();
