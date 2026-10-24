import { Href, Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Fragment, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppSettingsProvider, takeReturnTo, useAppSettings } from '../lib/app-settings';
import { FeedbackProvider } from '../lib/feedback';
import { t } from '../lib/i18n';
import { SessionProvider, useSession } from '../lib/session';
import { colors } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { session, profile, loading } = useSession();
  const { ready } = useAppSettings();
  const router = useRouter();
  const busy = loading || !ready;

  useEffect(() => {
    if (busy) return;
    SplashScreen.hideAsync().catch(() => {});
    // Тіл/тақырып ауысқаннан кейін пайдаланушыны сол бетке қайтарамыз
    const back = takeReturnTo();
    if (back) setTimeout(() => router.push(back as Href), 0);
  }, [busy, router]);

  if (busy) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  const signedIn = !!session;
  const hasProfile = signedIn && !!profile;
  const header = {
    headerShown: true,
    headerTransparent: false,
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
  };

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !profile} redirectTo={signedIn ? '/' : '/welcome'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={hasProfile} redirectTo={signedIn ? '/onboarding' : '/welcome'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="shift/[id]" options={{ ...header, title: t('shift.title') }} />
        <Stack.Screen name="profile-edit" options={{ ...header, title: t('profile.edit'), presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ ...header, title: t('settings.title') }} />
      </Stack.Protected>
      {/* Құжаттар кірмей тұрып та ашылады (тіркелу кезінде) */}
      <Stack.Screen name="legal/[doc]" options={{ ...header, title: '' }} />
    </Stack>
  );
}

// Тіл немесе тақырып ауысқанда ағаш қайта құрылады — барлық мәтін мен түс жаңарады
function Themed() {
  const { revision, scheme } = useAppSettings();
  return (
    <Fragment key={revision}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <FeedbackProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <RootStack />
        </FeedbackProvider>
      </View>
    </Fragment>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppSettingsProvider>
          <SessionProvider>
            <Themed />
          </SessionProvider>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
