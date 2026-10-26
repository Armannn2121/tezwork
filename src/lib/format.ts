import { t } from './i18n';

const p2 = (n: number) => String(n).padStart(2, '0');
const DAY_MS = 24 * 3600 * 1000;
const weekdays = () => t('time.weekdays').split(',');

// Ауысымдар Қазақстанда өтеді, сондықтан уақыт құрылғының белдеуіне қарамай әрқашан
// Қазақстан уақытымен (UTC+5, 2024 жылдан бері бүкіл ел бойынша) көрсетіледі.
// kz() қайтарған Date-тен тек getUTC* әдістерімен оқимыз.
export const KZ_OFFSET_MS = 5 * 3600 * 1000;
const kz = (d: string | number | Date) => new Date(new Date(d).getTime() + KZ_OFFSET_MS);
const kzDay = (d: string | number | Date) => Math.floor(kz(d).getTime() / DAY_MS);

export const ts = (iso: string) => new Date(iso).getTime();

export const formatKzt = (n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸';

export const formatTime = (iso: string) => {
  const d = kz(iso);
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
};

export const formatDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;

// 0 — бүгін, 1 — ертең, -1 — кеше (Қазақстан күнтізбесі бойынша)
export const dayOffset = (iso: string, now = new Date()) => kzDay(iso) - kzDay(now);

export function dayLabel(iso: string) {
  const off = dayOffset(iso);
  if (off === 0) return t('time.today');
  if (off === 1) return t('time.tomorrow');
  if (off === -1) return t('time.yesterday');
  const d = kz(iso);
  return `${weekdays()[d.getUTCDay()]}, ${p2(d.getUTCDate())}.${p2(d.getUTCMonth() + 1)}`;
}

export const shiftWhen = (startIso: string, endIso: string) =>
  `${dayLabel(startIso)} · ${formatTime(startIso)}–${formatTime(endIso)}`;

export const hoursBetween = (startIso: string, endIso: string) =>
  Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3600000);

export function formatHours(h: number) {
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  if (min === 0) return `${whole} ${t('time.h')}`;
  return whole ? `${whole} ${t('time.h')} ${min} ${t('time.min')}` : `${min} ${t('time.min')}`;
}

export const hourlyRate = (pay: number, startIso: string, endIso: string) => {
  const h = hoursBetween(startIso, endIso);
  return h > 0 ? pay / h : 0;
};

export function isNightShift(startIso: string, endIso: string) {
  const s = kz(startIso).getUTCHours();
  const e = kz(endIso).getUTCHours();
  return s >= 22 || s < 5 || dayOffset(endIso, new Date(startIso)) > 0 || e <= 5;
}

export function timeUntil(iso: string, now = new Date()) {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return t('time.started');
  const min = Math.round(ms / 60000);
  if (min < 60) return t('time.inMin', { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return t('time.inHours', { n: h });
  return t('time.inDays', { n: Math.round(h / 24) });
}

// Келесі n күн (Қазақстан күнтізбесі бойынша): { iso: 'YYYY-MM-DD', label, sub }
export function upcomingDays(n: number, now = new Date()) {
  const today = kz(now);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
    const iso = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
    const label = i === 0 ? t('time.today') : i === 1 ? t('time.tomorrow') : weekdays()[d.getUTCDay()];
    return { iso, label, sub: `${p2(d.getUTCDate())}.${p2(d.getUTCMonth() + 1)}` };
  });
}

export const timeSlots = (stepMin = 30) =>
  Array.from({ length: (24 * 60) / stepMin }, (_, i) => `${p2(Math.floor((i * stepMin) / 60))}:${p2((i * stepMin) % 60)}`);

// +7 (KZ/RU) нөмірлерін халықаралық пішімге келтіреді
export function normalizePhone(raw: string): string | null {
  let n = raw.replace(/\D/g, '');
  if (n.length === 11 && n.startsWith('8')) n = '7' + n.slice(1);
  if (n.length === 10) n = '7' + n;
  return /^7\d{10}$/.test(n) ? '+' + n : null;
}

// '7771234567' → '777 123 45 67' (енгізу кезінде)
export function maskLocalPhone(digits: string) {
  const d = digits.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ');
}

export function formatPhone(raw?: string | null) {
  if (!raw) return '';
  const n = raw.replace(/\D/g, '');
  if (n.length !== 11) return raw;
  return `+${n[0]} ${maskLocalPhone(n.slice(1))}`;
}

export const initials = (name?: string | null) =>
  (name ?? '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? '';
