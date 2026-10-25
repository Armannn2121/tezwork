import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useFeedback } from '../../lib/feedback';
import { t } from '../../lib/i18n';
import { takeRoleNotice, useSession } from '../../lib/session';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  const { profile } = useSession();
  const { confirm } = useFeedback();
  const router = useRouter();
  const isBiz = profile?.role === 'business';

  // Тіркелуде басқа рөл таңдалса, бірақ нөмір бұрын тіркелген болса — түсіндіреміз
  useEffect(() => {
    const role = takeRoleNotice();
    if (!role) return;
    confirm({
      title: t('role.mismatchTitle'),
      message: t('role.mismatchMsg', { role: t(role === 'business' ? 'role.business' : 'role.worker') }),
      confirm: t('role.goSettings'),
      cancel: t('common.close'),
    }).then((ok) => { if (ok) router.push('/settings'); });
  }, [confirm, router]);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isBiz ? t('tab.myShifts') : t('tab.jobs'),
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'flash' : 'flash-outline'} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t('tab.create'),
          href: isBiz ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: t('tab.my'),
          href: isBiz ? null : undefined,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'calendar' : 'calendar-outline'} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab.profile'),
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
