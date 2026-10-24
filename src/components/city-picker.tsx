import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cityName, POPULAR_CITIES, searchCities } from '../lib/cities';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import { colors, radius, themed } from '../lib/theme';

export const ALL_CITIES = '';

// Қаланы іздеп таңдайтын модаль терезе. allowAll — «Барлық қала» нұсқасын қосады (value = '')
export function CityPickerModal({ visible, value, onChange, onClose, allowAll }: {
  visible: boolean; value: string; onChange: (city: string) => void; onClose: () => void; allowAll?: boolean;
}) {
  const [q, setQ] = useState('');
  const list = searchCities(q);
  const pick = (id: string) => { haptic.select(); onChange(id); setQ(''); onClose(); };

  const header = q ? undefined : (
    <View>
      {allowAll && <Row label={t('common.allCities')} icon="earth-outline" active={value === ALL_CITIES} onPress={() => pick(ALL_CITIES)} />}
      <Text style={s.section}>{t('city.popular')}</Text>
      <View style={s.popular}>
        {POPULAR_CITIES.map((id) => (
          <Pressable key={id} onPress={() => pick(id)} style={[s.chip, value === id && s.chipActive]}>
            <Text style={[s.chipText, value === id && { color: colors.brandInk }]}>{cityName(id)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.section}>{t('city.allList')}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={s.top}>
          <Text style={s.title}>{t('city.choose')}</Text>
          <Pressable accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={12} style={s.close}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('city.search')}
            placeholderTextColor={colors.faint}
            style={s.input}
            autoCorrect={false}
          />
        </View>
        <FlatList
          data={list}
          keyExtractor={(id) => id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListHeaderComponent={header}
          ListEmptyComponent={<Text style={[s.section, { textAlign: 'center', marginTop: 24 }]}>{t('city.notFound')}</Text>}
          renderItem={({ item: id }) => <Row label={cityName(id)} icon="location-outline" active={value === id} onPress={() => pick(id)} />}
        />
      </SafeAreaView>
    </Modal>
  );
}

function Row({ label, icon, active, onPress }: { label: string; icon: 'location-outline' | 'earth-outline'; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.cardAlt }]}>
      <Ionicons name={icon} size={18} color={active ? colors.brand : colors.faint} />
      <Text style={[s.rowText, active && { color: colors.brand, fontWeight: '700' }]}>{label}</Text>
      {active && <Ionicons name="checkmark" size={20} color={colors.brand} />}
    </Pressable>
  );
}

// Формадағы өріс: басқанда модаль ашылады
export function CityField({ value, onChange, label }: { value: string; onChange: (c: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label ?? t('city.label')}</Text>
      <Pressable onPress={() => setOpen(true)} style={s.field}>
        <Ionicons name="location-outline" size={18} color={colors.brand} />
        <Text style={s.fieldText}>{cityName(value)}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.faint} />
      </Pressable>
      <CityPickerModal visible={open} value={value} onChange={onChange} onClose={() => setOpen(false)} />
    </View>
  );
}

const s = themed((c) => ({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { color: c.text, fontSize: 20, fontWeight: '800' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardAlt },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  input: { flex: 1, color: c.text, fontSize: 16, paddingVertical: 12, outlineStyle: 'none' } as never,
  section: { color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 8 },
  popular: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  chipActive: { backgroundColor: c.brand, borderColor: c.brand },
  chipText: { color: c.text, fontWeight: '600', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.border },
  rowText: { flex: 1, color: c.text, fontSize: 16 },
  label: { color: c.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14 },
  fieldText: { flex: 1, color: c.text, fontSize: 16 },
}));
