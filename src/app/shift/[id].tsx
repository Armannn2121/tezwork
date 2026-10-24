import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { humanError } from '../../lib/errors';
import { useFeedback } from '../../lib/feedback';
import { dayLabel, formatHours, formatKzt, formatTime, hourlyRate, hoursBetween, isNightShift, timeUntil, ts } from '../../lib/format';
import { useSession } from '../../lib/session';
import { getShift, patchShift } from '../../lib/shift-cache';
import { supabase } from '../../lib/supabase';
import { colors, radius } from '../../lib/theme';
import { Applicant, APPLICATION_STATUS, ApplicationStatus, categoryOf, ShiftView } from '../../lib/types';
import { Badge, Button, Card, EmptyState, ErrorBanner, IconText, Progress, SectionTitle, text } from '../../lib/ui';
import { useFocusQuery } from '../../lib/use-focus-query';
import { useNow } from '../../lib/use-now';

export default function ShiftDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useSession();
  const [shift, setShift] = useState<ShiftView | undefined>(() => getShift(id));
  const now = useNow();

  if (!shift) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState icon="alert-circle-outline" title="Ауысым табылмады" subtitle="Тізімге оралып, қайта ашып көріңіз" action={{ title: 'Артқа', onPress: () => router.back() }} />
      </View>
    );
  }

  const update = (patch: Partial<ShiftView>) => {
    patchShift(shift.id, patch);
    setShift({ ...shift, ...patch });
  };

  const hours = hoursBetween(shift.starts_at, shift.ends_at);
  const cat = categoryOf(shift.category);
  const place = [shift.city, shift.address].filter(Boolean).join(', ');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <View style={s.hero}>
        <View style={s.catIcon}><Ionicons name={cat.icon} size={26} color={colors.brand} /></View>
        <Text style={[text.h2, { marginTop: 12 }]}>{shift.title}</Text>
        {!!shift.company_name && <Text style={[text.muted, { fontSize: 15, marginTop: 2 }]}>{shift.company_name}</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <Badge label={cat.label} tone="neutral" />
          {isNightShift(shift.starts_at, shift.ends_at) && <Badge label="Түнгі" icon="moon" tone="info" />}
          {ts(shift.starts_at) > now && <Badge label={timeUntil(shift.starts_at, new Date(now))} icon="time" tone="brand" />}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={s.kpi}>
          <Text style={text.muted}>Төлем</Text>
          <Text style={[text.price, { fontSize: 22 }]}>{formatKzt(shift.pay_kzt)}</Text>
        </View>
        <View style={s.kpi}>
          <Text style={text.muted}>Сағатына</Text>
          <Text style={[text.title, { fontSize: 20 }]}>{formatKzt(hourlyRate(shift.pay_kzt, shift.starts_at, shift.ends_at))}</Text>
        </View>
      </View>

      <Card>
        <IconText icon="calendar-outline" color={colors.text}>{dayLabel(shift.starts_at)}</IconText>
        <IconText icon="time-outline" color={colors.text}>{formatTime(shift.starts_at)} – {formatTime(shift.ends_at)} · {formatHours(hours)}</IconText>
        <IconText icon="location-outline" color={colors.text}>{place}</IconText>
        <Button
          title="Картадан ашу (2GIS)"
          icon="map-outline"
          variant="secondary"
          size="sm"
          style={{ marginTop: 12 }}
          onPress={() => Linking.openURL(`https://2gis.kz/search/${encodeURIComponent(place)}`)}
        />
      </Card>

      {profile?.role === 'business'
        ? <BusinessPanel shift={shift} onChange={update} />
        : <WorkerPanel shift={shift} onChange={update} />}
    </ScrollView>
  );
}

// ---------------- Орындаушы әрекеттері ----------------
function WorkerPanel({ shift, onChange }: { shift: ShiftView; onChange: (p: Partial<ShiftView>) => void }) {
  const { toast, confirm } = useFeedback();
  const [busy, setBusy] = useState(false);
  const status = shift.application_status;
  const now = useNow();
  const future = ts(shift.starts_at) > now;

  async function apply() {
    if (!(await confirm({ title: 'Ауысымға жазылу', message: `${shift.title}\nТөлем: ${formatKzt(shift.pay_kzt)}`, confirm: 'Жазылу' }))) return;
    setBusy(true);
    const { error } = await supabase.rpc('apply_to_shift', { p_shift_id: shift.id });
    setBusy(false);
    if (error) return toast(humanError(error), 'error');
    onChange({ applied: true, application_status: 'confirmed', spots_left: (shift.spots_left ?? 1) - 1 });
    toast('Жазылдыңыз!', 'success');
  }

  async function cancel() {
    if (!shift.application_id) return;
    const ok = await confirm({ title: 'Жазылудан бас тарту', message: 'Орныңыз басқа жұмысшыларға босайды.', confirm: 'Бас тарту', cancel: 'Қалдыру', destructive: true });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc('cancel_application', { p_application_id: shift.application_id });
    setBusy(false);
    if (error) return toast(humanError(error), 'error');
    onChange({ applied: false, application_status: 'cancelled' });
    toast('Бас тарттыңыз', 'info');
  }

  return (
    <View>
      {shift.spots ? (
        <Card>
          <Text style={text.muted}>Бос орын: {shift.spots_left ?? 0} / {shift.spots}</Text>
          <Progress value={1 - (shift.spots_left ?? 0) / shift.spots} />
        </Card>
      ) : null}
      {status && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={text.body}>Жазылу күйі</Text>
          <Badge label={APPLICATION_STATUS[status].label} tone={APPLICATION_STATUS[status].tone} />
        </Card>
      )}
      {status === 'confirmed' && future && shift.application_id
        ? <Button title="Жазылудан бас тарту" variant="danger" onPress={cancel} loading={busy} />
        : !shift.applied && future && (shift.spots_left ?? 0) > 0
          ? <Button title="Жазылу" icon="flash" onPress={apply} loading={busy} />
          : null}
      {status === 'confirmed' && future && (
        <Text style={[text.muted, { textAlign: 'center', marginTop: 12 }]}>Ауысымға 10–15 минут ерте келіңіз 🙌</Text>
      )}
    </View>
  );
}

// ---------------- Бизнес әрекеттері ----------------
const NEXT: Partial<Record<ApplicationStatus, { to: ApplicationStatus; label: string }>> = {
  confirmed: { to: 'checked_in', label: 'Келді' },
  checked_in: { to: 'completed', label: 'Аяқтады' },
};

function BusinessPanel({ shift, onChange }: { shift: ShiftView; onChange: (p: Partial<ShiftView>) => void }) {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const now = useNow();
  const q = useFocusQuery<Applicant[]>(`applicants:${shift.id}`, () => supabase.rpc('shift_applicants', { p_shift_id: shift.id }));
  const applicants = q.loading ? null : q.data ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(a: Applicant, to: ApplicationStatus) {
    setBusyId(a.application_id);
    const { error } = await supabase.rpc('set_application_status', { p_application_id: a.application_id, p_status: to });
    setBusyId(null);
    if (error) return toast(humanError(error), 'error');
    q.setData((list) => (list ?? []).map((x) => (x.application_id === a.application_id ? { ...x, status: to } : x)));
  }

  async function closeShift() {
    const ok = await confirm({ title: 'Ауысымды жабу', message: 'Ауысым жұмысшыларға көрінбей қалады. Жабасыз ба?', confirm: 'Жабу', destructive: true });
    if (!ok) return;
    const { error } = await supabase.from('shifts').update({ status: 'cancelled' }).eq('id', shift.id);
    if (error) return toast(humanError(error), 'error');
    onChange({ status: 'cancelled' });
    toast('Ауысым жабылды', 'info');
  }

  const active = (applicants ?? []).filter((a) => a.status !== 'cancelled');
  const started = ts(shift.starts_at) <= now;

  return (
    <View>
      <Card>
        <Text style={text.muted}>Жазылған: {shift.taken ?? active.length} / {shift.spots ?? '—'}</Text>
        {shift.spots ? <Progress value={(shift.taken ?? active.length) / shift.spots} /> : null}
      </Card>

      <SectionTitle>Жазылғандар</SectionTitle>
      {q.error && <ErrorBanner message={q.error} onRetry={q.reload} />}
      {applicants === null ? <ActivityIndicator color={colors.brand} style={{ marginVertical: 20 }} /> : applicants.length === 0 ? (
        <Text style={[text.muted, { marginBottom: 12 }]}>Әзірше ешкім жазылмаған</Text>
      ) : (
        <View style={s.list}>
          {applicants.map((a) => {
            const st = APPLICATION_STATUS[a.status] ?? { label: a.status, tone: 'neutral' as const };
            const next = NEXT[a.status];
            return (
              <View key={a.application_id} style={s.applicant}>
                <View style={{ flex: 1 }}>
                  <Text style={text.body}>{a.full_name}</Text>
                  <View style={{ marginTop: 4 }}><Badge label={st.label} tone={st.tone} /></View>
                </View>
                {next && started && (
                  <Button title={next.label} size="sm" variant="secondary" loading={busyId === a.application_id} onPress={() => setStatus(a, next.to)} style={{ paddingHorizontal: 14, marginTop: 0 }} />
                )}
              </View>
            );
          })}
        </View>
      )}
      {!started && active.length > 0 && (
        <Text style={[text.muted, { marginBottom: 12 }]}>Ауысым басталғанда жұмысшыларды «Келді» / «Аяқтады» деп белгілей аласыз</Text>
      )}

      <Button title="Көшіріп, жаңа ауысым ашу" icon="copy-outline" variant="secondary" onPress={() => router.push({ pathname: '/create', params: { from: shift.id } })} />
      {shift.status === 'open' && ts(shift.ends_at) > now && (
        <Button title="Ауысымды жабу" variant="danger" icon="close-circle-outline" onPress={closeShift} style={{ marginTop: 10 }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingVertical: 8, marginBottom: 12 },
  catIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  kpi: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  list: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, marginBottom: 12, overflow: 'hidden' },
  applicant: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
