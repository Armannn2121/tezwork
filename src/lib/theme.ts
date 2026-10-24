import { StyleSheet } from 'react-native';

export type Palette = {
  bg: string; card: string; cardAlt: string; border: string;
  text: string; muted: string; faint: string;
  brand: string; brandInk: string; brandSoft: string;
  danger: string; dangerSoft: string; warn: string; warnSoft: string; info: string; infoSoft: string;
  overlay: string; logoBg: string;
};

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#F5F7FB',
    card: '#FFFFFF',
    cardAlt: '#EEF2F7',
    border: '#E2E8F0',
    text: '#0F172A',
    muted: '#64748B',
    faint: '#94A3B8',
    brand: '#059669',
    brandInk: '#FFFFFF',
    brandSoft: 'rgba(5,150,105,0.10)',
    danger: '#DC2626',
    dangerSoft: 'rgba(220,38,38,0.08)',
    warn: '#D97706',
    warnSoft: 'rgba(217,119,6,0.10)',
    info: '#2563EB',
    infoSoft: 'rgba(37,99,235,0.08)',
    overlay: 'rgba(15,23,42,0.45)',
    logoBg: '#FFFFFF',
  },
  dark: {
    bg: '#0B0F19',
    card: '#111827',
    cardAlt: '#162033',
    border: '#1E293B',
    text: '#F1F5F9',
    muted: '#94A3B8',
    faint: '#64748B',
    brand: '#10B981',
    brandInk: '#04130C',
    brandSoft: 'rgba(16,185,129,0.14)',
    danger: '#EF4444',
    dangerSoft: 'rgba(239,68,68,0.14)',
    warn: '#F59E0B',
    warnSoft: 'rgba(245,158,11,0.14)',
    info: '#60A5FA',
    infoSoft: 'rgba(96,165,250,0.14)',
    overlay: 'rgba(2,6,15,0.72)',
    logoBg: '#FFFFFF',
  },
};

// Ағымдағы түстер. Тақырып ауысқанда мәндері орнында ауыстырылып,
// AppSettingsProvider бүкіл ағашты қайта құрады — сондықтан `colors.x` әрқашан өзекті.
export const colors: Palette = { ...palettes.light };
export let isDark = false;
let version = 0;

let applied: 'light' | 'dark' = 'light';

export function applyPalette(scheme: 'light' | 'dark') {
  if (scheme === applied) return;
  applied = scheme;
  Object.assign(colors, palettes[scheme]);
  isDark = scheme === 'dark';
  version++;
}

// StyleSheet-ті тақырыпқа байланыстырады: стиль алғаш қолданылғанда (немесе тақырып ауысқанда) құрылады
// StyleSheet.create қабылдайтын тип (RN 0.88-де жеке экспортталмайды)
type Styles = Parameters<typeof StyleSheet.create>[0];

// `T & Styles` — StyleSheet.create-тегідей: мәндер литерал тип болып қалуы үшін
export function themed<T extends Styles>(fn: (c: Palette) => T & Styles): Readonly<T> {
  let builtFor = -1;
  let cache = {} as T;
  return new Proxy({} as T, {
    get(_, key) {
      if (builtFor !== version) {
        cache = StyleSheet.create(fn(colors));
        builtFor = version;
      }
      return cache[key as keyof T];
    },
  });
}

export type Tone = 'brand' | 'danger' | 'warn' | 'info' | 'neutral';

export const toneColor = (tone: Tone) => ({
  brand: { fg: colors.brand, bg: colors.brandSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  warn: { fg: colors.warn, bg: colors.warnSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  neutral: { fg: colors.muted, bg: colors.cardAlt },
}[tone]);

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };
