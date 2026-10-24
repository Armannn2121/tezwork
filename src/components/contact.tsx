import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, Text, View } from 'react-native';
import { formatPhone } from '../lib/format';
import { t } from '../lib/i18n';
import { colors, radius } from '../lib/theme';
import { Button } from '../lib/ui';

const digits = (phone: string) => phone.replace(/\D/g, '');

export const callPhone = (phone: string) => Linking.openURL(`tel:+${digits(phone)}`).catch(() => {});
export const openWhatsApp = (phone: string) => Linking.openURL(`https://wa.me/${digits(phone)}`).catch(() => {});

// Толық блок: нөмір + «Қоңырау» және «WhatsApp»
export function ContactCard({ title, phone }: { title: string; phone: string }) {
  return (
    <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 16, marginBottom: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</Text>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 }}>{formatPhone(phone)}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Button title={t('contact.call')} icon="call" size="sm" onPress={() => callPhone(phone)} style={{ flex: 1 }} />
        <Button title="WhatsApp" icon="logo-whatsapp" size="sm" variant="secondary" onPress={() => openWhatsApp(phone)} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// Шағын дөңгелек батырмалар (тізім жолдары үшін)
export function ContactIcons({ phone }: { phone: string }) {
  const btn = { width: 36, height: 36, borderRadius: 18, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.cardAlt };
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Pressable accessibilityLabel={t('contact.call')} onPress={() => callPhone(phone)} style={btn}>
        <Ionicons name="call" size={17} color={colors.brand} />
      </Pressable>
      <Pressable accessibilityLabel="WhatsApp" onPress={() => openWhatsApp(phone)} style={btn}>
        <Ionicons name="logo-whatsapp" size={17} color={colors.brand} />
      </Pressable>
    </View>
  );
}
