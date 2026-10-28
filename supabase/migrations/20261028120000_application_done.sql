-- Жұмысшы «Жұмыс аяқталды» басқан күй: жұмыс беруші растап, төлегенше күтеді
-- (enum мәні бөлек транзакцияда қосылуы керек)
alter type public.application_status add value if not exists 'done' after 'checked_in';
