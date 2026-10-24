// Supabase Auth «Send SMS Hook»: Supabase кодты жасайды, біз оны өзіміз жеткіземіз.
// Провайдерлер SMS_PROVIDERS ретімен сыналады (мыс. "telegram,smsc"): біреуі сәтсіз болса — келесісі.
//
// Секреттер (Supabase → Edge Functions → Secrets):
//   SEND_SMS_HOOK_SECRET   — Auth Hooks бетінде жасалған құпия (v1,whsec_...)
//   SMS_PROVIDERS          — "telegram", "smsc", "log" немесе олардың тізімі
//   TELEGRAM_GATEWAY_TOKEN — https://gateway.telegram.org ішіндегі токен
//   SMSC_LOGIN, SMSC_PASSWORD — smsc.kz аккаунты (қаласаңыз, SMSC_SENDER)
//   "log" — тек тестке: код Edge Function логына жазылады, ешкімге жіберілмейді.

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

type HookPayload = { user: { id: string; phone: string }; sms: { otp: string } };
type Sender = (phone: string, otp: string) => Promise<void>;

const env = (k: string) => Deno.env.get(k) ?? '';
const e164 = (phone: string) => (phone.startsWith('+') ? phone : `+${phone}`);

const message = (otp: string) => `TezWork: кіру коды ${otp}. Ешкімге айтпаңыз.`;

const providers: Record<string, Sender> = {
  // Telegram Gateway: кодты Telegram-ның ресми «Verification Codes» чатына жібереді
  async telegram(phone, otp) {
    const token = env('TELEGRAM_GATEWAY_TOKEN');
    if (!token) throw new Error('TELEGRAM_GATEWAY_TOKEN жоқ');
    const res = await fetch('https://gatewayapi.telegram.org/sendVerificationMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: e164(phone), code: otp, ttl: 300 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(`telegram: ${data.error ?? res.status}`);
  },

  // SMSC.kz HTTP API (fmt=3 → JSON жауап)
  async smsc(phone, otp) {
    const login = env('SMSC_LOGIN');
    const psw = env('SMSC_PASSWORD');
    if (!login || !psw) throw new Error('SMSC_LOGIN / SMSC_PASSWORD жоқ');
    const params = new URLSearchParams({
      login, psw, phones: phone.replace(/\D/g, ''), mes: message(otp), fmt: '3', charset: 'utf-8',
    });
    const sender = env('SMSC_SENDER');
    if (sender) params.set('sender', sender);
    const res = await fetch('https://smsc.kz/sys/send.php', { method: 'POST', body: params });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(`smsc: ${data.error ?? res.status}`);
  },

  // Тек әзірлеуге: кодты логқа жазады (Supabase → Logs → Edge Functions)
  async log(phone, otp) {
    console.log(`[send-sms-hook] ${phone} → ${otp}`);
  },
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const payload = await req.text();
  let event: HookPayload;
  try {
    const secret = env('SEND_SMS_HOOK_SECRET').replace(/^v1,whsec_/, '');
    event = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return json({ error: { http_code: 401, message: 'Invalid webhook signature' } }, 401);
  }

  const order = (env('SMS_PROVIDERS') || 'telegram').split(',').map((s) => s.trim()).filter(Boolean);
  const errors: string[] = [];
  for (const name of order) {
    const send = providers[name];
    if (!send) { errors.push(`${name}: белгісіз провайдер`); continue; }
    try {
      await send(event.user.phone, event.sms.otp);
      return new Response(null, { status: 200 });
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
    }
  }
  console.error('[send-sms-hook] failed', errors);
  return json({ error: { http_code: 502, message: `SMS жіберілмеді: ${errors.join('; ')}` } }, 502);
});
