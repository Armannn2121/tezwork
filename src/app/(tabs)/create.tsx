import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { AiAssist } from '../../components/ai-assist';
import { CityField } from '../../components/city-picker';
import { DayPicker, Stepper, TimePicker } from '../../components/pickers';
import { ShiftCard } from '../../components/shift-card';
import { resolveCity, ShiftDraft } from '../../lib/ai';
import { humanError, isIinMissing } from '../../lib/errors';
import { useFeedback } from '../../lib/feedback';
import { dayOffset, formatHours, formatKzt, formatTime, hoursBetween, upcomingDays } from '../../lib/format';
import { DEFAULT_CITY } from '../../lib/cities';
import { t } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { useIinGate } from '../../lib/use-iin-gate';
import { getShift } from '../../lib/shift-cache';
import { supabase } from '../../lib/supabase';
import { categories, WalletSummary } from '../../lib/types';
import { useFocusQuery } from '../../lib/use-focus-query';
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
  const iinGate = useIinGate();
  const src = from ? getShift(from) : undefined;
  const [title, setTitle] = useState(src?.title ?? '');
  const [category, setCategory] = useState(src?.category ?? 'retail');
  const [city, setCity] = useState(src?.city ?? profile?.city ?? DEFAULT_CITY);
  const [address, setAddress] = useState(src?.address ?? '');
  const [description, setDescription] = useState(src?.description ?? '');
  const wallet = useFocusQuery<WalletSummary[]>('my-wallet', () => supabase.rpc('my_wallet'));
  const balance = wallet.data?.[0]?.balance;
  const [date, setDate] = useState(tomorrow);
  const [start, setStart] = useState(src ? formatTime(src.starts_at) : '09:00');
  const [end, setEnd] = useState(src ? formatTime(src.ends_at) : '18:00');
  const [payMode, setPayMode] = useState<PayMode>('shift');
  const [pay, setPay] = useState(src ? String(src.pay_kzt) : '');
  const [spots, setSpots] = useState(src?.spots ?? 1);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  // AI толтырғанда уақыт таңдағыштары жаңа мәнге айналып көрінуі үшін қайта құрылады
  const [aiRound, setAiRound] = useState(0);

  function applyDraft(d: ShiftDraft) {
    if (d.title) setTitle(d.title);
    setCategory(d.category);
    const c = resolveCity(d.city);
    if (c) setCity(c);
    if (d.address) setAddress(d.address);
    if (d.description) setDescription(d.description);
    if (d.date) setDate(d.date);
    if (d.start) setStart(d.start);
    if (d.end) setEnd(d.end);
    setPayMode(d.pay_mode);
    if (d.pay > 0) setPay(String(d.pay));
    setSpots(d.spots);
    setErrors({});
    setAiRound((n) => n + 1);
    toast(t('ai.done'), 'success');
  }

  const { startsAt, endsAt } = toRange(date, start, end);
  const hours = hoursBetween(startsAt.toISOString(), endsAt.toISOString());
  const payN = parseInt(pay, 10) || 0;
  const total = payMode === 'hour' ? Math.round(payN * hours) : payN;

  async function save() {
    if (!session) return;
    // Жұмыс беруші 18+ — ЖСН-сіз жариялауға болмайды (серверде де тексеріледі)
    if (!(await iinGate())) return;
    const e: Errors = {};
    if (title.trim().length < 3) e.title = t('create.titleErr');
    if (startsAt <= new Date()) e.time = t('create.timeFuture');
    else if (hours > 16) e.time = t('create.timeLong');
    if (!(total > 0)) e.pay = t('create.payErr');
    setErrors(e);
    if (Object.keys(e).length) return toast(t('err.formCheck'), 'error');

    setBusy(true);
    const { error } = await supabase.from('shifts').insert({
      business_id: session.user.id,
      title: title.trim(), category, city,
      address: address.trim() || null,
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
      pay_kzt: total, spots,
      description: description.trim() || null,
    });
    setBusy(false);
    if (error) {
      if (isIinMissing(error)) { await iinGate(true); return; }
      return toast(humanError(error), 'error');
    }
    toast(t('create.published'), 'success');
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
        {src ? (
          <View style={{ backgroundColor: colors.infoSoft, borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <Text style={{ color: colors.info, fontWeight: '600' }}>{t('create.copied')}</Text>
          </View>
        ) : (
          <AiAssist onDraft={applyDraft} />
        )}

        <SectionTitle>{t('create.secJob')}</SectionTitle>
        <Field label={t('create.title')} value={title} onChangeText={(v) => { setTitle(v); setErrors({ ...errors, title: undefined }); }} placeholder={t('create.titlePh')} error={errors.title} />
        <Chips label={t('create.category')} scroll options={categories()} value={category} onChange={setCategory} />

        <SectionTitle>{t('create.secPlace')}</SectionTitle>
        <CityField value={city} onChange={setCity} />
        <Field label={t('create.address')} value={address} onChangeText={setAddress} placeholder={t('create.addressPh')} />
        <Field
          label={t('create.description')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('create.descriptionPh')}
          multiline
          maxLength={1000}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />

        <SectionTitle>{t('create.secTime')}</SectionTitle>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t('create.date')}</Text>
        <DayPicker key={`day-${aiRound}`} value={date} onChange={(d) => { setDate(d); setErrors({ ...errors, time: undefined }); }} />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t('create.start')}</Text>
        <TimePicker key={`start-${aiRound}`} value={start} onChange={(v) => { setStart(v); setErrors({ ...errors, time: undefined }); }} />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t('create.end')}</Text>
        <TimePicker key={`end-${aiRound}`} value={end} onChange={(v) => { setEnd(v); setErrors({ ...errors, time: undefined }); }} />
        <Text style={[text.muted, { marginBottom: 14, color: errors.time ? colors.danger : colors.muted }]}>
          {errors.time ?? `${t('create.duration', { d: formatHours(hours) })}${dayOffset(endsAt.toISOString(), startsAt) > 0 ? ` ${t('time.nextDay')}` : ''}`}
        </Text>

        <SectionTitle>{t('create.secPay')}</SectionTitle>
        <Segmented options={[{ id: 'shift', label: t('create.perShift') }, { id: 'hour', label: t('create.perHour') }]} value={payMode} onChange={setPayMode} />
        <Field
          label={payMode === 'hour' ? t('create.payHour') : t('create.payShift')}
          value={pay}
          onChangeText={(v) => { setPay(v.replace(/\D/g, '')); setErrors({ ...errors, pay: undefined }); }}
          keyboardType="number-pad"
          placeholder={payMode === 'hour' ? '2000' : '15000'}
          error={errors.pay}
          hint={payN > 0 ? (payMode === 'hour'
            ? t('create.payPerShiftHint', { pay: formatKzt(total) })
            : t('create.payPerHourHint', { pay: formatKzt(hours ? payN / hours : 0) })) : undefined}
        />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t('create.spots')}</Text>
        <Stepper value={spots} onChange={setSpots} max={200} />

        {title.trim().length >= 3 && total > 0 && (
          <>
            <SectionTitle>{t('create.preview')}</SectionTitle>
            <ShiftCard
              shift={{
                id: 'preview', title: title.trim(), category, city, address: address.trim() || null,
                starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), pay_kzt: total,
                company_name: profile?.company_name, spots, spots_left: spots,
              }}
            />
            <Text style={[text.muted, { marginBottom: 6 }]}>{t('create.total', { pay: formatKzt(total * spots) })}</Text>
            {balance !== undefined && balance < total * spots && (
              <View style={{ backgroundColor: colors.warnSoft, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                <Text style={{ color: colors.text, lineHeight: 19 }}>{t('wallet.low', { balance: formatKzt(balance), need: formatKzt(total * spots) })}</Text>
                <Text accessibilityRole="button" style={{ color: colors.brand, fontWeight: '700', marginTop: 6 }} onPress={() => router.push('/wallet')}>{t('wallet.topup')} →</Text>
              </View>
            )}
          </>
        )}

        <Button title={t('create.publish')} icon="paper-plane-outline" onPress={save} loading={busy} style={{ marginTop: 10 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
