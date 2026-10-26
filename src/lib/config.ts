// Қолдау байланыстары. Бос болса, «Баптаулар» бетінде көрсетілмейді.
export const SUPPORT_TELEGRAM = ''; // мыс. 'tezwork_support' (@-сыз)
export const SUPPORT_EMAIL = ''; // мыс. 'support@tezwork.kz'

// Құжаттардың соңғы жаңарту күні
export const LEGAL_UPDATED = '25.10.2026';

// ─── ДЕМО РЕЖИМІ ───
// SMS провайдері қосылғанша: код SMS орнына қосымшаның өзінде хабарлама ретінде шығады.
// Тек төмендегі тест нөмірлеріне — олар Supabase → Auth → Phone → Test Phone Numbers-те тұруы керек
// (басқа нөмірлердің кодын қосымшада көрсету қауіпті: кез келген адам бөтен аккаунтқа кіріп кетеді).
// ⚠ Нақты пайдаланушыларға шығармас бұрын DEMO_MODE = false қойыңыз.
export const DEMO_MODE = true;
export const DEMO_OTPS: Record<string, string> = {
  '+77771234567': '123456',
  '+77779876543': '123456',
};
export const demoOtpFor = (phone?: string | null) => (DEMO_MODE && phone ? DEMO_OTPS[phone] ?? null : null);
