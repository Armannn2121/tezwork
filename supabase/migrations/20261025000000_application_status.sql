-- TezWork v2: бизнес жұмысшыны «Келді» / «Аяқтады» деп белгілей алады.
-- Supabase Dashboard → SQL Editor ішінде іске қосыңыз (немесе `supabase db push`).
-- Болжам: public.applications(id, shift_id, status) және public.shifts(id, business_id) кестелері бар.

create or replace function public.set_application_status(p_application_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_owner uuid;
  v_starts timestamptz;
begin
  select a.status, s.business_id, s.starts_at
    into v_current, v_owner, v_starts
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

  update applications set status = p_status::application_status where id = p_application_id;
end;
$$;

revoke all on function public.set_application_status(uuid, text) from public, anon;
grant execute on function public.set_application_status(uuid, text) to authenticated;
