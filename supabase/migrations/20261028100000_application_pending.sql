-- Өтінімді растау: жаңа күйлер (enum мәндері бөлек транзакцияда қосылуы керек)
alter type public.application_status add value if not exists 'pending' before 'confirmed';
alter type public.application_status add value if not exists 'rejected';
