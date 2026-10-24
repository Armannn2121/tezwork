const p2 = (n: number) => String(n).padStart(2, '0');

const WEEKDAYS = ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'];
const DAY_MS = 24 * 3600 * 1000;

export const ts = (iso: string) => new Date(iso).getTime();

export const formatKzt =(n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸';

export const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

export function formatRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  return `${p2(s.getDate())}.${p2(s.getMonth() + 1)}  ${formatTime(startIso)} – ${formatTime(endIso)}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// 0 — бүгін, 1 — ертең, -1 — кеше
export const dayOffset = (iso: string, now = new Date()) =>
  Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / DAY_MS);

export function dayLabel(iso: string) {
  const off = dayOffset(iso);
  if (off === 0) return 'Бүгін';
  if (off === 1) return 'Ертең';
  if (off === -1) return 'Кеше';
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${p2(d.getDate())}.${p2(d.getMonth() + 1)}`;
}

export const shiftWhen = (startIso: string, endIso: string) =>
  `${dayLabel(startIso)} · ${formatTime(startIso)}–${formatTime(endIso)}`;

export const hoursBetween = (startIso: string, endIso: string) =>
  Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3600000);

export function formatHours(h: number) {
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  if (min === 0) return `${whole} сағ`;
  return whole ? `${whole} сағ ${min} мин` : `${min} мин`;
}

export const hourlyRate = (pay: number, startIso: string, endIso: string) => {
  const h = hoursBetween(startIso, endIso);
  return h > 0 ? pay / h : 0;
};

export function isNightShift(startIso: string, endIso: string) {
  const s = new Date(startIso).getHours();
  const e = new Date(endIso).getHours();
  return s >= 22 || s < 5 || dayOffset(endIso, new Date(startIso)) > 0 || e <= 5;
}

// «3 сағаттан кейін», «2 күннен кейін»
export function timeUntil(iso: string, now = new Date()) {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return 'басталды';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} минуттан кейін`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} сағаттан кейін`;
  return `${Math.round(h / 24)} күннен кейін`;
}

// Келесі n күн: { iso: 'YYYY-MM-DD', label, sub }
export function upcomingDays(n: number, now = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const label = i === 0 ? 'Бүгін' : i === 1 ? 'Ертең' : WEEKDAYS[d.getDay()];
    return { iso, label, sub: `${p2(d.getDate())}.${p2(d.getMonth() + 1)}` };
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
