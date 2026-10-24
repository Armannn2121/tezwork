import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { setHapticsEnabled } from './haptics';
import { Lang, setLangValue } from './i18n';
import { applyPalette } from './theme';

export type ThemeMode = 'light' | 'dark' | 'system';

type Settings = { lang: Lang; theme: ThemeMode; haptics: boolean };

type Ctx = Settings & {
  ready: boolean;
  scheme: 'light' | 'dark';
  /** Тіл немесе тақырып ауысқанда өзгереді — түбірдегі `key` ретінде қолданылады */
  revision: string;
  /** stay — тіл/тақырып ауысқаннан кейін осы бетке оралу */
  update: (patch: Partial<Settings>, stay?: string) => void;
};

const KEY = 'tezwork.settings.v1';

// Ағаш қайта құрылғаннан кейін қайтатын бет (мыс. «Баптаулар»)
let returnTo: string | null = null;
export const takeReturnTo = () => { const r = returnTo; returnTo = null; return r; };

const deviceLang = (): Lang => (getLocales()[0]?.languageCode === 'ru' ? 'ru' : 'kk');

const SettingsCtx = createContext<Ctx>({
  lang: 'kk', theme: 'light', haptics: true, ready: false, scheme: 'light', revision: '', update: () => {},
});

export const useAppSettings = () => useContext(SettingsCtx);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [settings, setSettings] = useState<Settings>({ lang: deviceLang(), theme: 'light', haptics: true });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) setSettings((s) => ({ ...s, ...(JSON.parse(raw) as Partial<Settings>) })); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const scheme = settings.theme === 'system' ? system : settings.theme;

  // Модуль деңгейіндегі мәндерді рендерден бұрын синхрондаймыз
  setLangValue(settings.lang);
  applyPalette(scheme);
  setHapticsEnabled(settings.haptics);

  const update = useCallback((patch: Partial<Settings>, stay?: string) => {
    if (stay) returnTo = stay;
    setSettings((s) => {
      const next = { ...s, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <SettingsCtx.Provider value={{ ...settings, ready, scheme, revision: `${settings.lang}:${scheme}`, update }}>
      {children}
    </SettingsCtx.Provider>
  );
}
