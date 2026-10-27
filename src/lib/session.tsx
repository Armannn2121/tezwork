import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { maskIin } from './kz-id';
import { draftFromMetadata, getDraft, RegistrationDraft, setDraft } from './registration';
import { clearShiftCache } from './shift-cache';
import { supabase } from './supabase';
import { Profile } from './types';
import { clearQueryCache } from './use-focus-query';

type SessionState = {
  session: Session | null;
  profile: Profile | null;
  /** Пайдаланушының ЖСН-і (тек өзіне көрінеді). Кэштен ашылғанда — жасырылған түрі */
  iin: string | null;
  loading: boolean;
  /** Профильді желі қатесінен жүктей алмадық */
  loadError: boolean;
  retry: () => void;
  refreshProfile: () => Promise<void>;
  /** Сервер қайтарған жаңа профильді қайта сұрамай қолдану */
  applyProfile: (p: Profile) => void;
  saveIin: (iin: string) => Promise<{ error: { message: string; code?: string } | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionState>({
  session: null, profile: null, iin: null, loading: true, loadError: false, retry: () => {},
  refreshProfile: async () => {}, applyProfile: () => {}, saveIin: async () => ({ error: null }), signOut: async () => {},
});

export const useSession = () => useContext(Ctx);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Желі баяу болса сұранысты бірнеше рет қайталаймыз; бәрі сәтсіз болса — қате лақтырамыз.
// Маңызды: желі қатесін «профиль жоқ» деп ұғуға болмайды, әйтпесе онбординг ашылып кетеді.
async function withRetry<T>(fn: () => PromiseLike<{ data: T; error: { message: string } | null }>, attempts = 3) {
  let last: { message: string } | null = null;
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await fn();
    if (!error) return data;
    last = error;
    await sleep(600 * (i + 1));
  }
  throw new Error(last?.message ?? 'network');
}

async function fetchProfile(uid: string) {
  const data = await withRetry(() => supabase.from('profiles').select('*').eq('id', uid).maybeSingle());
  return (data as Profile) ?? null;
}

// ЖСН жүктелмесе — null (қосымша ЖСН қосуды ұсынады, бірақ профильге әсер етпейді)
async function fetchIin(uid: string) {
  try {
    const data = await withRetry(() => supabase.from('private_profiles').select('iin').eq('id', uid).maybeSingle());
    return (data as { iin: string } | null)?.iin ?? null;
  } catch {
    return null;
  }
}

export async function insertProfile(uid: string, d: RegistrationDraft) {
  const base = {
    id: uid, role: d.role, full_name: d.full_name.trim(), city: d.city,
    company_name: d.role === 'business' ? d.company_name?.trim() || null : null,
  };
  const extra = { company_bin: d.role === 'business' ? d.company_bin || null : null, terms_accepted_at: new Date().toISOString() };
  let { error } = await supabase.from('profiles').insert({ ...base, ...extra });
  // Миграция әлі жіберілмесе, жаңа бағандар жоқ — оларсыз қайталаймыз
  if (error?.code === 'PGRST204') ({ error } = await supabase.from('profiles').insert(base));
  if (!error && d.iin) {
    await supabase.from('private_profiles').insert({ id: uid, iin: d.iin });
  }
  return { error };
}

// Тіркелуде басқа рөл таңдалып, бірақ нөмір бұрын тіркелген болса — бір рет ескертеміз
let roleNotice: Profile['role'] | null = null;
export const takeRoleNotice = () => { const r = roleNotice; roleNotice = null; return r; };

// Профиль жоқ болса — тіркелу кезінде толтырылған деректерден құрамыз
async function ensureProfile(user: User): Promise<{ profile: Profile | null; created: boolean }> {
  const existing = await fetchProfile(user.id);
  if (existing) {
    const d = getDraft();
    if (d && d.role !== existing.role) roleNotice = existing.role;
    setDraft(null);
    return { profile: existing, created: false };
  }
  const d = getDraft() ?? draftFromMetadata(user.user_metadata);
  if (!d) return { profile: null, created: false };
  const { error } = await insertProfile(user.id, d);
  setDraft(null);
  if (error) return { profile: null, created: false }; // онда онбординг экраны ашылады
  return { profile: await fetchProfile(user.id), created: true };
}

// Соңғы профиль құрылғыда сақталады: қосымша ашылғанда сервер жауабын (~0.3–0.7 с) күтпей бірден көрсетеміз.
// ЖСН толық түрде сақталмайды — тек жасырылған түрі (көрсету және «бар/жоқ» тексерісі үшін жеткілікті).
const CACHE_KEY = 'tezwork.profile.v1';
type Cached = { uid: string; profile: Profile; iin: string | null };

async function readCache(uid: string): Promise<Cached | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const c = raw ? (JSON.parse(raw) as Cached) : null;
    return c?.uid === uid && c.profile ? c : null;
  } catch {
    return null;
  }
}

function writeCache(uid: string, profile: Profile | null, iin: string | null) {
  const job = profile
    ? AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ uid, profile, iin: iin ? maskIin(iin) : null }))
    : AsyncStorage.removeItem(CACHE_KEY);
  job.catch(() => {});
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [iin, setIin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const loadedUid = useRef<string | null | undefined>(undefined);
  const sessionRef = useRef<Session | null>(null);

  const load = useCallback(async (s: Session | null) => {
    const uid = s?.user.id ?? null;
    const current = () => loadedUid.current === uid;
    setLoadError(false);
    if (!s || !uid) {
      setProfile(null); setIin(null); setLoading(false);
      return;
    }
    // Тіркелу аяқталып жатқанда кэш жоқ — профиль құрылуын күтеміз
    const cached = getDraft() ? null : await readCache(uid);
    if (cached && current()) {
      setProfile(cached.profile); setIin(cached.iin); setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      // Профиль мен ЖСН қатар жүктеледі — бір сұраныс уақыты
      const [{ profile: p, created }, i] = await Promise.all([ensureProfile(s.user), fetchIin(uid)]);
      // Жаңа профиль құрылса, ЖСН сонымен бірге енді ғана сақталды
      const finalIin = created ? await fetchIin(uid) : i;
      if (!current()) return;
      setProfile(p); setIin(finalIin);
    } catch {
      // Желі қатесі — кэш болса, соны қалдырамыз; болмаса қайталау экранын көрсетеміз
      if (current() && !cached) setLoadError(true);
    } finally {
      if (current()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      sessionRef.current = s;
      const uid = s?.user.id ?? null;
      // Токен жаңарғанда профильді қайта жүктемейміз — экран жыпылықтамасын
      if (uid === loadedUid.current) return;
      // Басқа пайдаланушы (немесе шығу) — алдыңғы аккаунттың деректерін тазалаймыз
      if (loadedUid.current !== undefined) {
        clearQueryCache();
        clearShiftCache();
        if (!uid) writeCache('', null, null);
      }
      loadedUid.current = uid;
      // Supabase кеңесі: callback ішінде басқа supabase шақыруларын күтпеу
      setTimeout(() => { load(s); }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const retry = useCallback(() => { load(sessionRef.current); }, [load]);

  // Сәтсіз болса бұрынғы профильді сақтаймыз (пайдаланушыны онбордингке лақтырмаймыз)
  const refreshProfile = useCallback(async () => {
    const uid = sessionRef.current?.user.id;
    if (!uid) return;
    try {
      const [p, i] = await Promise.all([fetchProfile(uid), fetchIin(uid)]);
      // Арада шығып кетсе — ескі профильді қайта орнатпаймыз
      if (p && sessionRef.current?.user.id === uid) {
        setProfile(p);
        setIin(i);
      }
    } catch {
      // келесі жолы қайта жүктеледі
    }
  }, []);

  const applyProfile = useCallback((p: Profile) => setProfile(p), []);

  const saveIin = useCallback(async (value: string) => {
    const uid = sessionRef.current?.user.id;
    if (!uid) return { error: null };
    const { error } = await supabase.from('private_profiles').insert({ id: uid, iin: value });
    if (!error) setIin(value);
    return { error };
  }, []);

  // Профиль немесе ЖСН өзгерген сайын құрылғыдағы көшірмені жаңартамыз
  useEffect(() => {
    if (profile) writeCache(profile.id, profile, iin);
  }, [profile, iin]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  // Мән тек күй өзгергенде жаңарады — әйтпесе барлық экран әр рендерде қайта салынады
  const value = useMemo(
    () => ({ session, profile, iin, loading, loadError, retry, refreshProfile, applyProfile, saveIin, signOut }),
    [session, profile, iin, loading, loadError, retry, refreshProfile, applyProfile, saveIin, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
