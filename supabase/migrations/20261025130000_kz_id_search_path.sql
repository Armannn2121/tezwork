-- Supabase advisor (0011_function_search_path_mutable): функциялардың search_path-ын бекітеміз.
-- Бос search_path — тек pg_catalog; kz_iin_birthdate ішіндегі шақыру public.-пен толық жазылған.
alter function public.is_valid_kz_id(text) set search_path = '';
alter function public.kz_iin_birthdate(text) set search_path = '';
