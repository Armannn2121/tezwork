import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { draftFromMetadata, getDraft, RegistrationDraft, setDraft } from './registration';
import { supabase } from './supabase';
import { Profile } from './types';

type SessionState = {
  session: Session | null;
  profile: Profile | null;
  /** Пайдаланушының ЖСН-і (тек өзіне көрінеді) */
  iin: string | null;
  loading: boolean;
  /** Профильді желі қатесінен жүктей алмадық */
  loadError: boolean;
  retry: () => void;
  refreshProfile: () => Promise<void>;
  saveIin: (iin: string) => Promise<{ error: { message: string; code?: string } | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionState>({
  session: null, profile: null, iin: null, loading: true, loadError: false, retry: () => {},
  refreshProfile: async () => {}, saveIin: async () => ({ error: null }), signOut: async () => {},
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
async function ensureProfile(user: User): Promise<Profile | null> {
  const existing = await fetchProfile(user.id);
  if (existing) {
    const d = getDraft();
    if (d && d.role !== existing.role) roleNotice = existing.role;
    setDraft(null);
    return existing;
  }
  const d = getDraft() ?? draftFromMetadata(user.user_metadata);
  if (!d) return null;
  const { error } = await insertProfile(user.id, d);
  setDraft(null);
  if (error) return null; // онда онбординг экраны ашылады
  return fetchProfile(user.id);
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
    setLoading(true);
    setLoadError(false);
    try {
      const p = s ? await ensureProfile(s.user) : null;
      const i = s && p ? await fetchIin(s.user.id) : null;
      if (loadedUid.current === uid) {
        setProfile(p);
        setIin(i);
      }
    } catch {
      // Желі қатесі — профильді «жоқ» деп белгілемей, қайталау экранын көрсетеміз
      if (loadedUid.current === uid) setLoadError(true);
    } finally {
      if (loadedUid.current === uid) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      sessionRef.current = s;
      const uid = s?.user.id ?? null;
      // Токен жаңарғанда профильді қайта жүктемейміз — экран жыпылықтамасын
      if (uid === loadedUid.current) return;
      loadedUid.current = uid;
      // Supabase кеңесі: callback ішінде басқа supabase шақыруларын күтпеу
      setTimeout(() => { load(s); }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const retry = useCallback(() => { load(sessionRef.current); }, [load]);

  // Сәтсіз болса бұрынғы профильді сақтаймыз (пайдаланушыны онбордингке лақтырмаймыз)
  const refreshProfile = useCallback(async () => {
    if (!session) return;
    try {
      const p = await fetchProfile(session.user.id);
      if (p) {
        setProfile(p);
        setIin(await fetchIin(session.user.id));
      }
    } catch {
      // келесі жолы қайта жүктеледі
    }
  }, [session]);

  const saveIin = useCallback(async (value: string) => {
    if (!session) return { error: null };
    const { error } = await supabase.from('private_profiles').insert({ id: session.user.id, iin: value });
    if (!error) setIin(value);
    return { error };
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  return (
    <Ctx.Provider value={{ session, profile, iin, loading, loadError, retry, refreshProfile, saveIin, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
