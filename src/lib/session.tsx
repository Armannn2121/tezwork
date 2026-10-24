import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { draftFromMetadata, getDraft, setDraft } from './registration';
import { supabase } from './supabase';
import { Profile } from './types';

type SessionState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionState>({
  session: null, profile: null, loading: true,
  refreshProfile: async () => {}, signOut: async () => {},
});

export const useSession = () => useContext(Ctx);

async function fetchProfile(uid: string) {
  const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  return (data as Profile) ?? null;
}

// Профиль жоқ болса — тіркелу кезінде толтырылған деректерден құрамыз
async function ensureProfile(user: User): Promise<Profile | null> {
  const existing = await fetchProfile(user.id);
  if (existing) { setDraft(null); return existing; }
  const d = getDraft() ?? draftFromMetadata(user.user_metadata);
  if (!d) return null;
  const { error } = await supabase.from('profiles').insert({
    id: user.id, role: d.role, full_name: d.full_name.trim(),
    company_name: d.role === 'business' ? d.company_name?.trim() || null : null, city: d.city,
  });
  setDraft(null);
  if (error) return null; // онда онбординг экраны ашылады
  return fetchProfile(user.id);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
        if (loadedUid.current === uid) {
          setProfile(p);
          setLoading(false);
        }
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) setProfile(await fetchProfile(session.user.id));
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  return (
    <Ctx.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
