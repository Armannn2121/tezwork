import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, ScrollViewInstance, Text, View } from 'react-native';
import { haptic } from '../lib/haptics';
import { timeSlots, upcomingDays } from '../lib/format';
import { colors, radius, themed } from '../lib/theme';

export function DayPicker({ value, onChange, days = 14 }: { value: string; onChange: (iso: string) => void; days?: number }) {
  const items = useMemo(() => upcomingDays(days), [days]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 14 }}>
      {items.map((d) => {
        const active = d.iso === value;
        return (
          <Pressable key={d.iso} onPress={() => { haptic.select(); onChange(d.iso); }} style={[s.day, active && s.active]}>
            <Text style={[s.dayLabel, active && { color: colors.brandInk }]}>{d.label}</Text>
            <Text style={[s.daySub, active && { color: colors.brandInk }]}>{d.sub}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const SLOT_W = 72;

export function TimePicker({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const slots = useMemo(() => timeSlots(30), []);
  const ref = useRef<ScrollViewInstance>(null);
  const idx = Math.max(0, slots.indexOf(value));
  useEffect(() => {
    // таңдалған уақытты көрінетін жерге жылжытамыз
    const t = setTimeout(() => ref.current?.scrollTo({ x: Math.max(0, idx * (SLOT_W + 8) - SLOT_W), animated: false }), 0);
    return () => clearTimeout(t);
    // тек алғашқы рендерде
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 14 }}>
      {slots.map((t) => {
        const active = t === value;
        return (
          <Pressable key={t} onPress={() => { haptic.select(); onChange(t); }} style={[s.slot, active && s.active]}>
            <Text style={[s.slotText, active && { color: colors.brandInk }]}>{t}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Stepper({ value, onChange, min = 1, max = 100 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const set = (n: number) => { haptic.select(); onChange(Math.min(max, Math.max(min, n))); };
  return (
    <View style={s.stepper}>
      <Pressable accessibilityLabel="−" onPress={() => set(value - 1)} disabled={value <= min} style={[s.stepBtn, value <= min && { opacity: 0.4 }]}>
        <Ionicons name="remove" size={22} color={colors.text} />
      </Pressable>
      <Text style={s.stepValue}>{value}</Text>
      <Pressable accessibilityLabel="+" onPress={() => set(value + 1)} disabled={value >= max} style={[s.stepBtn, value >= max && { opacity: 0.4 }]}>
        <Ionicons name="add" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const s = themed((colors) => ({
  day: { width: 64, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  dayLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
  daySub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  active: { backgroundColor: colors.brand, borderColor: colors.brand },
  slot: { width: SLOT_W, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  slotText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 14 },
  stepBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: colors.text, fontSize: 18, fontWeight: '800', minWidth: 44, textAlign: 'center' },
}));
