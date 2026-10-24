import { t, TKey } from './i18n';

type AnyError = { message?: string; code?: string; status?: number } | null | undefined;

// Сервер (RPC) қазақша қайтаратын хабарламалар → аударма кілттері
const SERVER_MESSAGES: [RegExp, TKey][] = [
  [/Тек орындаушы жазыла алады/, 'err.onlyWorker'],
  [/Ауысым қолжетімсіз/, 'err.shiftUnavailable'],
  [/Ауысым басталып кеткен/, 'err.shiftStarted'],
  [/Бос орын қалмады/, 'err.noSpots'],
  [/жазылып қойғансыз/, 'err.alreadyApplied'],
  [/ЖСН көрсетілмеген/, 'err.iinMissing'],
  [/16 жастан/, 'err.tooYoung'],
  [/18 жастан/, 'err.tooYoungEmployer'],
  [/әлі басталған жоқ/, 'err.notStartedYet'],
];

// Supabase қателерін пайдаланушыға түсінікті мәтінге айналдырады
export function humanError(e: AnyError): string {
  const msg = e?.message ?? '';
  const code = e?.code ?? '';
  const known = SERVER_MESSAGES.find(([re]) => re.test(msg));
  if (known) return t(known[1]);
  if (isUnregistered(e)) return t('err.unregistered');
  if (code === 'otp_expired' || (/expired|invalid/i.test(msg) && /token|otp/i.test(msg))) return t('err.otp');
  if (code === 'over_sms_send_rate_limit' || /only request this after|rate limit/i.test(msg)) return t('err.rateLimit');
  if (code === 'sms_send_failed' || /sending (confirmation |)otp|sms provider/i.test(msg)) return t('err.sms');
  if (/network request failed|failed to fetch|fetch failed/i.test(msg)) return t('err.network');
  if (code === 'PGRST202' || code === 'PGRST205' || /could not find the (function|table)/i.test(msg)) return t('err.notDeployed');
  if (code === '23505' && /iin/i.test(msg)) return t('err.iinTaken');
  if (code === '42501' || /row-level security/i.test(msg)) return t('err.forbidden');
  return msg || t('err.unknown');
}

// shouldCreateUser: false кезінде жоқ пайдаланушы осындай қате қайтарады
export function isUnregistered(e: AnyError): boolean {
  return e?.code === 'otp_disabled' || /signups not allowed/i.test(e?.message ?? '');
}

export const isIinMissing = (e: AnyError) => /ЖСН көрсетілмеген/.test(e?.message ?? '');
