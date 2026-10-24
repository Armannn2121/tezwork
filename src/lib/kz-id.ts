// ЖСН / БСН (ИИН / БИН) — 12 цифр, соңғысы бақылау цифры.
// Алгоритм серверде де бар: supabase/migrations/20261025120000_iin_terms.sql (is_valid_kz_id)

const W1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const W2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

export function isValidKzId(v: string): boolean {
  if (!/^\d{12}$/.test(v)) return false;
  const d = v.split('').map(Number);
  let c = W1.reduce((s, w, i) => s + w * d[i], 0) % 11;
  if (c === 10) {
    c = W2.reduce((s, w, i) => s + w * d[i], 0) % 11;
    if (c === 10) return false;
  }
  return c === d[11];
}

export type IinInfo = { birth: Date; gender: 'male' | 'female'; age: number };

// ЖСН: ЖЖААКК + ғасыр/жыныс цифры (1–6) + реттік нөмір + бақылау
export function parseIin(v: string, now = new Date()): IinInfo | null {
  if (!isValidKzId(v)) return null;
  const c = Number(v[6]);
  const base = c === 1 || c === 2 ? 1800 : c === 3 || c === 4 ? 1900 : c === 5 || c === 6 ? 2000 : 0;
  if (!base) return null;
  const y = base + Number(v.slice(0, 2));
  const m = Number(v.slice(2, 4));
  const day = Number(v.slice(4, 6));
  const birth = new Date(y, m - 1, day);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== day || birth > now) return null;
  let age = now.getFullYear() - y;
  if (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < day)) age--;
  return { birth, gender: c % 2 === 1 ? 'male' : 'female', age };
}

export const MIN_WORK_AGE = 16;

export type IinError = 'iin.len' | 'iin.invalid' | 'iin.young';

export function validateIin(v: string): IinError | null {
  if (v.length !== 12) return 'iin.len';
  const info = parseIin(v);
  if (!info) return 'iin.invalid';
  if (info.age < MIN_WORK_AGE) return 'iin.young';
  return null;
}

export function validateBin(v: string): 'bin.len' | 'bin.invalid' | null {
  if (v.length !== 12) return 'bin.len';
  return isValidKzId(v) ? null : 'bin.invalid';
}

export const maskIin = (v: string) => (v.length === 12 ? `${v.slice(0, 6)}••••${v.slice(10)}` : v);
