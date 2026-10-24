import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { humanError } from './errors';

type Result = PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

/**
 * Экран ашылған сайын деректерді жүктейді. `key` өзгергенде қайта жүктеледі.
 * Pull-to-refresh, қате және бос күйлерді бір жерде ұстайды.
 */
export function useFocusQuery<T>(key: string, fetcher: () => Result, onData?: (d: T) => void) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  const onDataRef = useRef(onData);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
    onDataRef.current = onData;
  });

  const reload = useCallback(async () => {
    try {
      const { data: d, error: e } = await fetcherRef.current();
      if (e) setError(humanError(e));
      else {
        setError(null);
        setData(d as T);
        onDataRef.current?.(d as T);
      }
    } catch (e) {
      setError(humanError(e as Error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // key өзгерсе — жаңа сұраныс
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const refresh = useCallback(() => { setRefreshing(true); reload(); }, [reload]);

  return { data, setData, loading, refreshing, error, reload, refresh };
}
