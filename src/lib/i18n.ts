import { kk } from './locales/kk';
import { ru } from './locales/ru';

export type Lang = 'kk' | 'ru';
export type TKey = keyof typeof kk;

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'kk', label: 'Қазақша' },
  { id: 'ru', label: 'Русский' },
];

const dicts: Record<Lang, Record<TKey, string>> = { kk, ru };

// Ағымдағы тіл. Ауысқанда AppSettingsProvider бүкіл ағашты қайта құрады.
let current: Lang = 'kk';

export const getLang = () => current;
export const setLangValue = (l: Lang) => { current = l; };

export function t(key: TKey, vars?: Record<string, string | number>) {
  const s = dicts[current][key] ?? kk[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : s;
}
