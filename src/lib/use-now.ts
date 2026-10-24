import { useEffect, useState } from 'react';

// Ағымдағы уақыт (мс), минут сайын жаңарады — «N сағаттан кейін» сияқты мәтіндер үшін
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
