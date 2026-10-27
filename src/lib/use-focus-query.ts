import { useFocusEffect } from 'expo-router';
import { SetStateAction, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { humanError } from './errors';

type Result = PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

// Соңғы жүктелген деректер (key бойынша). Экран қайта ашылғанда скелетон орнына бірден көрсетіледі,
// ал жаңасы фонда жүктеледі. Сервер алыс болғандықтан (әр сұраныс ~0.3 с) бұл ең көп байқалатын жылдамдық.
const cache = new Map<string, unknown>();

/** Басқа аккаунтпен кіргенде алдыңғы пайдаланушының деректері көрінбеуі үшін */
export const clearQueryCache = () => cache.clear();

/**
 * Экран ашылған сайын деректерді жүктейді. `key` өзгергенде қайта жүктеледі.
 * Pull-to-refresh, қате және бос күйлерді бір жерде ұстайды.
 */
export function useFocusQuery<T>(key: string, fetcher: () => Result, onData?: (d: T) => void) {
  const [state, setState] = useState<{ key: string; data: T | null }>(() => ({ key, data: (cache.get(key) as T | undefined) ?? null }));
  const [loading, setLoading] = useState(() => !cache.has(key));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  const onDataRef = useRef(onData);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
    onDataRef.current = onData;
  });

  // key ауысса (мыс. басқа қала) — сол key-дің кэшін көрсетеміз
  if (state.key !== key) {
    const hit = cache.has(key);
    setState({ key, data: (cache.get(key) as T | undefined) ?? null });
    setLoading(!hit);
  }

  const setData = useCallback((v: SetStateAction<T | null>) => {
    setState((s) => {
      const data = typeof v === 'function' ? (v as (p: T | null) => T | null)(s.data) : v;
      if (data !== null) cache.set(s.key, data);
      return { ...s, data };
    });
  }, []);

  const reload = useCallback(async () => {
    try {
      const { data: d, error: e } = await fetcherRef.current();
      if (e) setError(humanError(e));
      else {
        setError(null);
        cache.set(key, d);
        setState((s) => (s.key === key ? { key, data: d as T } : s));
        onDataRef.current?.(d as T);
      }
    } catch (e) {
      setError(humanError(e as Error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [key]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const refresh = useCallback(() => { setRefreshing(true); reload(); }, [reload]);

  return { data: state.data, setData, loading, refreshing, error, reload, refresh };
}
