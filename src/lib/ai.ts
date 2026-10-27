import { FunctionsHttpError } from '@supabase/supabase-js';
import { searchCities } from './cities';
import { TKey } from './i18n';
import { supabase } from './supabase';

// ai-shift-draft Edge Function қайтаратын жоба (supabase/functions/ai-shift-draft)
export type ShiftDraft = {
  title: string; category: string; city: string; address: string;
  date: string; start: string; end: string;
  pay_mode: 'shift' | 'hour'; pay: number; spots: number;
  description: string; missing: string[];
};

export type AiError = 'too_short' | 'too_long' | 'not_configured' | 'busy' | 'forbidden' | 'ai_error' | 'network';

export const AI_ERROR_KEY: Record<AiError, TKey> = {
  too_short: 'ai.err.tooShort',
  too_long: 'ai.err.tooLong',
  not_configured: 'ai.err.notConfigured',
  busy: 'ai.err.busy',
  forbidden: 'err.forbidden',
  ai_error: 'ai.err.generic',
  network: 'err.network',
};

// «Мәтінде жоқ» өрістердің формадағы атауы
export const AI_FIELD_KEY: Record<string, TKey> = {
  title: 'create.title', city: 'city.label', address: 'create.address', date: 'create.date',
  start: 'create.start', end: 'create.end', pay: 'create.secPay', description: 'create.description',
};

export async function draftShift(text: string): Promise<{ draft: ShiftDraft } | { error: AiError }> {
  const { data, error } = await supabase.functions.invoke('ai-shift-draft', { body: { text } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      const code = body?.error as AiError | undefined;
      return { error: code && code in AI_ERROR_KEY ? code : 'ai_error' };
    }
    return { error: 'network' };
  }
  return { draft: (data as { draft: ShiftDraft }).draft };
}

// Модель қаланы қалай жазса солай қайтарады («Алматы», «Караганда», «в Астане») — тізімдегі id-ге келтіреміз
export function resolveCity(name: string): string | null {
  const s = name.trim().toLowerCase();
  if (!s) return null;
  // searchCities қазақша да, орысша да іздейді; дәл сәйкесі алдымен («Ақсу», «Ақсай» емес)
  const hits = searchCities(s);
  const exact = hits.find((id) => id.toLowerCase() === s);
  if (exact || hits[0]) return exact ?? hits[0];
  // орысша септік жалғауы: «Астане», «Караганде» → түбірі бойынша
  return s.length > 4 ? searchCities(s.slice(0, -1))[0] ?? null : null;
}
