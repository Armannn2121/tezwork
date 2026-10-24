import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSession } from '../../lib/session';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  const { profile } = useSession();
  const isBiz = profile?.role === 'business';
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
          title: isBiz ? 'Ауысымдарым' : 'Жұмыстар',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'flash' : 'flash-outline'} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Жариялау',
          href: isBiz ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: 'Жазылымдарым',
          href: isBiz ? null : undefined,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'calendar' : 'calendar-outline'} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
