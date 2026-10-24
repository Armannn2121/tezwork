export const colors = {
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
};

export type Tone = 'brand' | 'danger' | 'warn' | 'info' | 'neutral';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: colors.brand, bg: colors.brandSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  warn: { fg: colors.warn, bg: colors.warnSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  neutral: { fg: colors.muted, bg: colors.cardAlt },
};

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };
