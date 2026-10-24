import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FeedbackProvider } from '../lib/feedback';
import { SessionProvider, useSession } from '../lib/session';
import { colors } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const header = {
  headerShown: true,
  headerTransparent: false,
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
};

function RootStack() {
  const { session, profile, loading } = useSession();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  const signedIn = !!session;
  const ready = signedIn && !!profile;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !profile} redirectTo={signedIn ? '/' : '/welcome'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={ready} redirectTo={signedIn ? '/onboarding' : '/welcome'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="shift/[id]" options={{ ...header, title: 'Ауысым' }} />
        <Stack.Screen name="profile-edit" options={{ ...header, title: 'Профильді өңдеу', presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <SessionProvider>
          <FeedbackProvider>
            <StatusBar style="light" />
            <RootStack />
          </FeedbackProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
