type AnyError = { message?: string; code?: string; status?: number } | null | undefined;

// Supabase қателерін пайдаланушыға түсінікті мәтінге айналдырады
export function humanError(e: AnyError): string {
  const msg = e?.message ?? '';
  const code = e?.code ?? '';
  if (isUnregistered(e)) return 'Бұл нөмір тіркелмеген. Алдымен тіркеліңіз.';
  if (/expired|invalid/i.test(msg) && /token|otp/i.test(msg)) return 'Код қате немесе мерзімі өтті';
  if (code === 'over_sms_send_rate_limit' || /only request this after|rate limit/i.test(msg))
    return 'Тым жиі сұрадыңыз. Бір минуттан соң қайталаңыз.';
  if (/network request failed|failed to fetch|fetch failed/i.test(msg)) return 'Интернет байланысын тексеріңіз';
  if (code === 'PGRST202' || /could not find the function/i.test(msg))
    return 'Бұл мүмкіндік серверде әлі қосылмаған (supabase/migrations ішіндегі SQL-ды іске қосыңыз)';
  if (code === '42501' || /row-level security/i.test(msg)) return 'Бұл әрекетке рұқсат жоқ';
  return msg || 'Белгісіз қате';
}

// shouldCreateUser: false кезінде жоқ пайдаланушы осындай қате қайтарады
export function isUnregistered(e: AnyError): boolean {
  return e?.code === 'otp_disabled' || /signups not allowed/i.test(e?.message ?? '');
}
