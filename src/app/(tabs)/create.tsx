import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { DayPicker, Stepper, TimePicker } from '../../components/pickers';
import { ShiftCard } from '../../components/shift-card';
import { humanError } from '../../lib/errors';
import { useFeedback } from '../../lib/feedback';
import { formatHours, formatKzt, formatTime, hoursBetween, upcomingDays } from '../../lib/format';
import { useSession } from '../../lib/session';
import { getShift } from '../../lib/shift-cache';
import { supabase } from '../../lib/supabase';
import { CATEGORIES, CITIES } from '../../lib/types';
import { Button, Chips, colors, Field, SectionTitle, Segmented, text } from '../../lib/ui';

// Қазақстан уақыты: UTC+5
const TZ = '+05:00';

type PayMode = 'shift' | 'hour';
type Errors = Partial<Record<'title' | 'time' | 'pay', string>>;

const tomorrow = () => upcomingDays(2)[1].iso;

function toRange(date: string, start: string, end: string) {
  const startsAt = new Date(`${date}T${start}:00${TZ}`);
  let endsAt = new Date(`${date}T${end}:00${TZ}`);
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3600 * 1000); // түнгі ауысым
  return { startsAt, endsAt };
}

export default function CreateShift() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [round, setRound] = useState(0);
  // «Көшіру» батырмасынан келсе немесе жарияланса — форма жаңадан құрылады
  return <ShiftForm key={`${from ?? 'new'}:${round}`} from={from} onDone={() => setRound(round + 1)} />;
}

function ShiftForm({ from, onDone }: { from?: string; onDone: () => void }) {
  const router = useRouter();
  const { session, profile } = useSession();
  const { toast } = useFeedback();
  const src = from ? getShift(from) : undefined;
  const [title, setTitle] = useState(src?.title ?? '');
  const [category, setCategory] = useState(src?.category ?? 'retail');
  const [city, setCity] = useState(src?.city ?? profile?.city ?? CITIES[0]);
  const [address, setAddress] = useState(src?.address ?? '');
  const [date, setDate] = useState(tomorrow);
  const [start, setStart] = useState(src ? formatTime(src.starts_at) : '09:00');
  const [end, setEnd] = useState(src ? formatTime(src.ends_at) : '18:00');
  const [payMode, setPayMode] = useState<PayMode>('shift');
  const [pay, setPay] = useState(src ? String(src.pay_kzt) : '');
  const [spots, setSpots] = useState(src?.spots ?? 1);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const { startsAt, endsAt } = toRange(date, start, end);
  const hours = hoursBetween(startsAt.toISOString(), endsAt.toISOString());
  const payN = parseInt(pay, 10) || 0;
  const total = payMode === 'hour' ? Math.round(payN * hours) : payN;

  async function save() {
    if (!session) return;
    const e: Errors = {};
    if (title.trim().length < 3) e.title = 'Жұмыс атауын жазыңыз (кемінде 3 әріп)';
    if (startsAt <= new Date()) e.time = 'Ауысым болашақта басталуы керек';
    else if (hours > 16) e.time = 'Ауысым 16 сағаттан ұзақ болмауы керек';
    if (!(total > 0)) e.pay = 'Төлем сомасын жазыңыз';
    setErrors(e);
    if (Object.keys(e).length) return toast('Форманы тексеріңіз', 'error');

    setBusy(true);
    const { error } = await supabase.from('shifts').insert({
      business_id: session.user.id,
      title: title.trim(), category, city,
      address: address.trim() || null,
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
      pay_kzt: total, spots,
    });
    setBusy(false);
    if (error) return toast(humanError(error), 'error');
    toast('Ауысым жарияланды!', 'success');
    if (from) router.setParams({ from: undefined });
    onDone();
    router.navigate('/');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        {src && (
          <View style={{ backgroundColor: colors.infoSoft, borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <Text style={{ color: colors.info, fontWeight: '600' }}>Бұрынғы ауысымнан көшірілді — күнін таңдаңыз</Text>
          </View>
        )}

        <SectionTitle>Жұмыс</SectionTitle>
        <Field label="Жұмыс атауы" value={title} onChangeText={(t) => { setTitle(t); setErrors({ ...errors, title: undefined }); }} placeholder="Мысалы: тапсырыс жинаушы" error={errors.title} />
        <Chips label="Санат" scroll options={CATEGORIES} value={category} onChange={setCategory} />

        <SectionTitle>Орны</SectionTitle>
        <Chips label="Қала" options={CITIES.map((c) => ({ id: c, label: c }))} value={city} onChange={setCity} />
        <Field label="Мекенжай" value={address} onChangeText={setAddress} placeholder="Абай даңғ. 109" />

        <SectionTitle>Уақыты</SectionTitle>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Күні</Text>
        <DayPicker value={date} onChange={(d) => { setDate(d); setErrors({ ...errors, time: undefined }); }} />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Басталуы</Text>
        <TimePicker value={start} onChange={(t) => { setStart(t); setErrors({ ...errors, time: undefined }); }} />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Аяқталуы</Text>
        <TimePicker value={end} onChange={(t) => { setEnd(t); setErrors({ ...errors, time: undefined }); }} />
        <Text style={[text.muted, { marginBottom: 14, color: errors.time ? colors.danger : colors.muted }]}>
          {errors.time ?? `Ұзақтығы: ${formatHours(hours)}${endsAt.getDate() !== startsAt.getDate() ? ' (келесі күні аяқталады)' : ''}`}
        </Text>

        <SectionTitle>Төлем және адам саны</SectionTitle>
        <Segmented options={[{ id: 'shift', label: 'Ауысымға' }, { id: 'hour', label: 'Сағатына' }]} value={payMode} onChange={setPayMode} />
        <Field
          label={payMode === 'hour' ? 'Сағатына төлем (₸)' : 'Бір адамға ауысымға төлем (₸)'}
          value={pay}
          onChangeText={(t) => { setPay(t.replace(/\D/g, '')); setErrors({ ...errors, pay: undefined }); }}
          keyboardType="number-pad"
          placeholder={payMode === 'hour' ? '2000' : '15000'}
          error={errors.pay}
          hint={payN > 0 ? (payMode === 'hour'
            ? `Ауысымға: ${formatKzt(total)}`
            : `≈ ${formatKzt(hours ? payN / hours : 0)}/сағ`) : undefined}
        />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Қанша адам керек</Text>
        <Stepper value={spots} onChange={setSpots} max={200} />

        {title.trim().length >= 3 && total > 0 && (
          <>
            <SectionTitle>Жұмысшылар осылай көреді</SectionTitle>
            <ShiftCard
              shift={{
                id: 'preview', title: title.trim(), category, city, address: address.trim() || null,
                starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), pay_kzt: total,
                company_name: profile?.company_name, spots, spots_left: spots,
              }}
            />
            <Text style={[text.muted, { marginBottom: 6 }]}>Барлық шығын: {formatKzt(total * spots)}</Text>
          </>
        )}

        <Button title="Жариялау" icon="paper-plane-outline" onPress={save} loading={busy} style={{ marginTop: 10 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
