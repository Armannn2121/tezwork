import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { draftFromMetadata, getDraft, RegistrationDraft, setDraft } from './registration';
import { supabase } from './supabase';
import { Profile } from './types';

type SessionState = {
  session: Session | null;
  profile: Profile | null;
  /** Жұмысшының ЖСН-і (тек өзіне көрінеді) */
  iin: string | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  saveIin: (iin: string) => Promise<{ error: { message: string; code?: string } | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionState>({
  session: null, profile: null, iin: null, loading: true,
  refreshProfile: async () => {}, saveIin: async () => ({ error: null }), signOut: async () => {},
});

export const useSession = () => useContext(Ctx);

async function fetchProfile(uid: string) {
  const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  return (data as Profile) ?? null;
}

// private_profiles кестесі әлі жоқ болса (миграция жіберілмеген) — null
async function fetchIin(uid: string) {
  const { data } = await supabase.from('private_profiles').select('iin').eq('id', uid).maybeSingle();
  return (data as { iin: string } | null)?.iin ?? null;
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
  if (!error && d.role === 'worker' && d.iin) {
    await supabase.from('private_profiles').insert({ id: uid, iin: d.iin });
  }
  return { error };
}

// Профиль жоқ болса — тіркелу кезінде толтырылған деректерден құрамыз
async function ensureProfile(user: User): Promise<Profile | null> {
  const existing = await fetchProfile(user.id);
  if (existing) { setDraft(null); return existing; }
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
  const loadedUid = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      const uid = s?.user.id ?? null;
      // Токен жаңарғанда профильді қайта жүктемейміз — экран жыпылықтамасын
      if (uid === loadedUid.current) return;
      loadedUid.current = uid;
      setLoading(true);
      // Supabase кеңесі: callback ішінде басқа supabase шақыруларын күтпеу
      setTimeout(async () => {
        const p = s ? await ensureProfile(s.user) : null;
        const i = s && p?.role === 'worker' ? await fetchIin(s.user.id) : null;
        if (loadedUid.current === uid) {
          setProfile(p);
          setIin(i);
          setLoading(false);
        }
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    setProfile(p);
    if (p?.role === 'worker') setIin(await fetchIin(session.user.id));
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
    <Ctx.Provider value={{ session, profile, iin, loading, refreshProfile, saveIin, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
