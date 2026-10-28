import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { ContactCard, ContactIcons } from '../../components/contact';
import { RateModal, RatingBadge } from '../../components/rating';
import { cityName } from '../../lib/cities';
import { humanError, isIinMissing } from '../../lib/errors';
import { useFeedback } from '../../lib/feedback';
import { dayLabel, formatHours, formatKzt, formatTime, hourlyRate, hoursBetween, isNightShift, timeUntil, ts } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { getShift, patchShift } from '../../lib/shift-cache';
import { loadShift } from '../../lib/shift-loader';
import { shareText } from '../../lib/share';
import { supabase } from '../../lib/supabase';
import { colors, radius, themed } from '../../lib/theme';
import { Applicant, ApplicationStatus, categoryOf, isAccepted, ShiftView, STATUS_TONE, statusLabel } from '../../lib/types';
import { Badge, Button, Card, EmptyState, ErrorBanner, IconText, Progress, SectionTitle, text } from '../../lib/ui';
import { useFocusQuery } from '../../lib/use-focus-query';
import { cancelShiftReminder } from '../../lib/reminders';
import { useIinGate } from '../../lib/use-iin-gate';
import { useNow } from '../../lib/use-now';

export default function ShiftDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useSession();
  const { toast } = useFeedback();
  const [shift, setShift] = useState<ShiftView | undefined>(() => getShift(id));
  const [loaded, setLoaded] = useState(false);
  const now = useNow();

  // Кэштегіні бірден көрсетеміз, ал серверден жаңасын әрқашан жүктейміз
  // (бетті жаңартқанда немесе сілтемемен ашқанда кэш бос болады)
  useEffect(() => {
    let alive = true;
    loadShift(id, profile?.role)
      .then((fresh) => { if (alive && fresh) setShift((prev) => ({ ...prev, ...fresh })); })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [id, profile?.role]);

  if (!shift && !loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!shift) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState icon="alert-circle-outline" title={t('shift.notFound')} subtitle={t('shift.notFoundSub')} action={{ title: t('common.back'), onPress: () => router.back() }} />
      </View>
    );
  }

  // Функционалды жаңарту: фондағы сұраныс кейін келсе де, арадағы өзгерістер өшпейді
  const update = (patch: Partial<ShiftView>) => {
    patchShift(shift.id, patch);
    setShift((cur) => (cur ? { ...cur, ...patch } : cur));
  };

  const hours = hoursBetween(shift.starts_at, shift.ends_at);
  const cat = categoryOf(shift.category);
  const place = [cityName(shift.city), shift.address].filter(Boolean).join(', ');

  const share = async () => {
    const message = t('shift.shareText', { title: shift.title, when: `${dayLabel(shift.starts_at)} ${formatTime(shift.starts_at)}–${formatTime(shift.ends_at)}`, place, pay: formatKzt(shift.pay_kzt) });
    const res = await shareText(message);
    if (res === 'copied') toast(t('common.copied'), 'success');
    if (res === 'failed') toast(t('err.unknown'), 'error');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <View style={s.hero}>
        <View style={s.catIcon}><Ionicons name={cat.icon} size={26} color={colors.brand} /></View>
        <Text style={[text.h2, { marginTop: 12 }]}>{shift.title}</Text>
        {!!shift.company_name && <Text style={[text.muted, { fontSize: 15, marginTop: 2 }]}>{shift.company_name}</Text>}
        {shift.company_reviews !== undefined && <View style={{ marginTop: 4 }}><RatingBadge avg={shift.company_rating} count={shift.company_reviews} /></View>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <Badge label={cat.label} tone="neutral" />
          {!!shift.status && shift.status !== 'open' && <Badge label={t('biz.closed')} icon="lock-closed" tone="danger" />}
          {isNightShift(shift.starts_at, shift.ends_at) && <Badge label={t('shift.night')} icon="moon" tone="info" />}
          {ts(shift.starts_at) > now && <Badge label={timeUntil(shift.starts_at, new Date(now))} icon="time" tone="brand" />}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={s.kpi}>
          <Text style={text.muted}>{t('shift.pay')}</Text>
          <Text style={[text.price, { fontSize: 22 }]}>{formatKzt(shift.pay_kzt)}</Text>
        </View>
        <View style={s.kpi}>
          <Text style={text.muted}>{t('shift.perHour')}</Text>
          <Text style={[text.title, { fontSize: 20 }]}>{formatKzt(hourlyRate(shift.pay_kzt, shift.starts_at, shift.ends_at))}</Text>
        </View>
      </View>

      <Card>
        <IconText icon="calendar-outline" color={colors.text}>{dayLabel(shift.starts_at)}</IconText>
        <IconText icon="time-outline" color={colors.text}>{formatTime(shift.starts_at)} – {formatTime(shift.ends_at)} · {formatHours(hours)}</IconText>
        <IconText icon="location-outline" color={colors.text}>{place}</IconText>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button
            title={t('shift.map')}
            icon="map-outline"
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => Linking.openURL(`https://2gis.kz/search/${encodeURIComponent(place)}`)}
          />
          <Button title={t('common.share')} icon="share-outline" variant="secondary" size="sm" style={{ flex: 1 }} onPress={share} />
        </View>
      </Card>

      {!!shift.description && (
        <Card>
          <Text style={[text.muted, { fontWeight: '700', marginBottom: 6 }]}>{t('shift.description')}</Text>
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{shift.description}</Text>
        </Card>
      )}

      {profile?.role === 'business'
        ? <BusinessPanel shift={shift} onChange={update} />
        : <WorkerPanel shift={shift} onChange={update} />}
    </ScrollView>
  );
}

// ---------------- Орындаушы әрекеттері ----------------
function WorkerPanel({ shift, onChange }: { shift: ShiftView; onChange: (p: Partial<ShiftView>) => void }) {
  const { toast, confirm } = useFeedback();
  const iinGate = useIinGate();
  const [busy, setBusy] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const status = shift.application_status;
  const now = useNow();
  const future = ts(shift.starts_at) > now;

  async function apply() {
    if (!(await iinGate())) return;
    const message = t('feed.applyMsg', { title: shift.title, when: dayLabel(shift.starts_at), pay: formatKzt(shift.pay_kzt) });
    if (!(await confirm({ title: t('feed.applyTitle'), message, confirm: t('feed.apply'), cancel: t('common.cancel') }))) return;
    setBusy(true);
    const { error } = await supabase.rpc('apply_to_shift', { p_shift_id: shift.id });
    setBusy(false);
    if (error) {
      if (isIinMissing(error)) { await iinGate(true); return; }
      return toast(humanError(error), 'error');
    }
    onChange({ applied: true, application_status: 'pending' });
    toast(t('shift.applied'), 'success');
    // Өтінім id-сін (бас тарту үшін) фонда жүктейміз — пайдаланушы күтпейді
    loadShift(shift.id, 'worker')
      .then((fresh) => { if (fresh) onChange({ application_id: fresh.application_id, application_status: fresh.application_status, spots_left: fresh.spots_left }); })
      .catch(() => {});
  }

  async function cancel() {
    if (!shift.application_id) return;
    const ok = await confirm({ title: t('my.cancelTitle'), message: t('my.cancelMsg'), confirm: t('my.cancel'), cancel: t('my.keep'), destructive: true });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc('cancel_application', { p_application_id: shift.application_id });
    setBusy(false);
    if (error) return toast(humanError(error), 'error');
    onChange({ applied: false, application_status: 'cancelled' });
    cancelShiftReminder(shift.id);
    toast(t('my.cancelled'), 'info');
  }

  return (
    <View>
      {shift.spots ? (
        <Card>
          <Text style={text.muted}>{t('shift.spotsFree', { left: shift.spots_left ?? 0, spots: shift.spots })}</Text>
          <Progress value={1 - (shift.spots_left ?? 0) / shift.spots} />
        </Card>
      ) : null}
      {status && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={text.body}>{t('shift.applyStatus')}</Text>
          <Badge label={statusLabel(status)} tone={STATUS_TONE[status]} />
        </Card>
      )}
      {status === 'pending' && <Text style={[text.muted, { marginBottom: 12 }]}>{t('shift.pendingHint')}</Text>}
      {status === 'rejected' && <Text style={[text.muted, { marginBottom: 12 }]}>{t('shift.rejectedHint')}</Text>}
      {(status === 'pending' || status === 'confirmed') && future && shift.application_id
        ? <Button title={t('shift.cancelApply')} variant="danger" onPress={cancel} loading={busy} />
        : !shift.applied && status !== 'rejected' && future && (shift.spots_left ?? 0) > 0
          ? <Button title={t('feed.apply')} icon="flash" onPress={apply} loading={busy} />
          : null}
      {isAccepted(status) && !!shift.business_phone && (
        <ContactCard title={t('contact.employer')} phone={shift.business_phone} />
      )}
      {status === 'completed' && shift.application_id && (
        shift.my_stars
          ? <Text style={[text.muted, { textAlign: 'center', marginBottom: 8 }]}>{t('rating.yours', { n: shift.my_stars })}</Text>
          : <Button title={t('rating.rate')} icon="star-outline" variant="secondary" onPress={() => setRateOpen(true)} />
      )}
      {status === 'confirmed' && future && (
        <Text style={[text.muted, { textAlign: 'center', marginTop: 12 }]}>{t('shift.comeEarly')}</Text>
      )}
      <RateModal
        visible={rateOpen}
        applicationId={shift.application_id ?? null}
        title={shift.company_name ?? shift.title}
        onClose={() => setRateOpen(false)}
        onDone={(n) => onChange({ my_stars: n })}
      />
    </View>
  );
}

// ---------------- Бизнес әрекеттері ----------------
const NEXT: Partial<Record<ApplicationStatus, { to: ApplicationStatus; label: () => string }>> = {
  confirmed: { to: 'checked_in', label: () => t('shift.markIn') },
  checked_in: { to: 'completed', label: () => t('shift.markDone') },
};

function BusinessPanel({ shift, onChange }: { shift: ShiftView; onChange: (p: Partial<ShiftView>) => void }) {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const now = useNow();
  const q = useFocusQuery<Applicant[]>(`applicants:${shift.id}`, () => supabase.rpc('shift_applicants', { p_shift_id: shift.id }));
  const applicants = q.loading ? null : q.data ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rateFor, setRateFor] = useState<Applicant | null>(null);

  async function setStatus(a: Applicant, to: ApplicationStatus) {
    // Аяқтау = төлем: қайтарылмайтын әрекет, сондықтан сұраймыз
    if (to === 'completed') {
      const ok = await confirm({
        title: t('shift.payTitle'),
        message: t('shift.payMsg', { pay: formatKzt(shift.pay_kzt), name: a.full_name }),
        confirm: t('shift.payConfirm'), cancel: t('common.cancel'),
      });
      if (!ok) return;
    }
    setBusyId(a.application_id);
    const { error } = await supabase.rpc('set_application_status', { p_application_id: a.application_id, p_status: to });
    setBusyId(null);
    if (error) return toast(humanError(error), 'error');
    q.setData((list) => (list ?? []).map((x) => (x.application_id === a.application_id ? { ...x, status: to } : x)));
    if (to === 'completed') toast(t('shift.paid', { name: a.full_name }), 'success');
  }

  async function decide(a: Applicant, accept: boolean) {
    if (!accept) {
      const ok = await confirm({
        title: t('shift.rejectTitle'), message: t('shift.rejectMsg', { name: a.full_name }),
        confirm: t('shift.reject'), cancel: t('common.cancel'), destructive: true,
      });
      if (!ok) return;
    }
    setBusyId(a.application_id);
    const { error } = await supabase.rpc('decide_application', { p_application_id: a.application_id, p_accept: accept });
    setBusyId(null);
    if (error) return toast(humanError(error), 'error');
    if (accept) {
      const taken = (shift.taken ?? 0) + 1;
      onChange({ taken, spots_left: Math.max(0, (shift.spots ?? taken) - taken) });
      toast(t('shift.accepted', { name: a.full_name }), 'success');
      q.reload(); // орын толса, қалған өтінімдерге сервер өзі бас тартады
    } else {
      q.setData((list) => (list ?? []).filter((x) => x.application_id !== a.application_id));
    }
  }

  async function closeShift() {
    const ok = await confirm({ title: t('shift.close'), message: t('shift.closeMsg'), confirm: t('common.close'), cancel: t('common.cancel'), destructive: true });
    if (!ok) return;
    const { error } = await supabase.from('shifts').update({ status: 'cancelled' }).eq('id', shift.id);
    if (error) return toast(humanError(error), 'error');
    onChange({ status: 'cancelled' });
    toast(t('shift.closed'), 'info');
    q.reload(); // расталған жазылымдар да жабылды
  }

  const active = (applicants ?? []).filter((a) => isAccepted(a.status));
  const hasPending = (applicants ?? []).some((a) => a.status === 'pending');
  const started = ts(shift.starts_at) <= now;

  return (
    <View>
      <Card>
        <Text style={text.muted}>{t('shift.takenOf', { taken: shift.taken ?? active.length, spots: shift.spots ?? '—' })}</Text>
        {shift.spots ? <Progress value={(shift.taken ?? active.length) / shift.spots} /> : null}
      </Card>

      <SectionTitle>{t('shift.applicants')}</SectionTitle>
      {q.error && <ErrorBanner message={q.error} onRetry={q.reload} />}
      {applicants === null ? <ActivityIndicator color={colors.brand} style={{ marginVertical: 20 }} /> : applicants.length === 0 ? (
        <Text style={[text.muted, { marginBottom: 12 }]}>{t('shift.noApplicants')}</Text>
      ) : (
        <View style={s.list}>
          {applicants.map((a) => {
            const next = NEXT[a.status];
            return (
              <View key={a.application_id} style={s.applicant}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[text.body, { flexShrink: 1 }]} numberOfLines={1}>{a.full_name}</Text>
                    {a.worker_reviews !== undefined && <RatingBadge avg={a.worker_rating} count={a.worker_reviews} size={12} />}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <Badge label={statusLabel(a.status)} tone={STATUS_TONE[a.status] ?? 'neutral'} />
                    {!!a.my_stars && <Text style={{ color: colors.muted, fontSize: 12 }}>{t('rating.yours', { n: a.my_stars })}</Text>}
                  </View>
                </View>
                {!!a.worker_phone && <ContactIcons phone={a.worker_phone} />}
                {a.status === 'pending' && shift.status === 'open' && ts(shift.ends_at) > now && (
                  <View style={{ flexBasis: '100%', flexDirection: 'row', gap: 8 }}>
                    <Button title={t('shift.accept')} size="sm" icon="checkmark" loading={busyId === a.application_id} onPress={() => decide(a, true)} style={{ flex: 1, marginTop: 0 }} />
                    <Button title={t('shift.reject')} size="sm" variant="secondary" disabled={busyId === a.application_id} onPress={() => decide(a, false)} style={{ flex: 1, marginTop: 0 }} />
                  </View>
                )}
                {/* Жабық ауысымға «Келді» белгіленбейді; бірақ келіп қойғанның жұмысын аяқтап, төлеуге болады */}
                {next && started && (shift.status === 'open' || a.status === 'checked_in') && (
                  <Button title={next.label()} size="sm" variant="secondary" loading={busyId === a.application_id} onPress={() => setStatus(a, next.to)} style={{ paddingHorizontal: 14, marginTop: 0 }} />
                )}
                {a.status === 'completed' && !a.my_stars && (
                  <Button title={t('rating.rate')} icon="star-outline" size="sm" variant="secondary" onPress={() => setRateFor(a)} style={{ paddingHorizontal: 12, marginTop: 0 }} />
                )}
              </View>
            );
          })}
        </View>
      )}
      {hasPending && shift.status === 'open' && (
        <Text style={[text.muted, { marginBottom: 12 }]}>{t('shift.pendingHelp')}</Text>
      )}
      {!started && active.length > 0 && (
        <Text style={[text.muted, { marginBottom: 12 }]}>{t('shift.markLater')}</Text>
      )}

      <Button title={t('shift.copy')} icon="copy-outline" variant="secondary" onPress={() => router.push({ pathname: '/create', params: { from: shift.id } })} />
      {shift.status === 'open' && ts(shift.ends_at) > now && (
        <Button title={t('shift.close')} variant="danger" icon="close-circle-outline" onPress={closeShift} style={{ marginTop: 10 }} />
      )}
      <RateModal
        visible={!!rateFor}
        applicationId={rateFor?.application_id ?? null}
        title={rateFor?.full_name ?? ''}
        onClose={() => setRateFor(null)}
        onDone={(n) => q.setData((list) => (list ?? []).map((x) => (x.application_id === rateFor?.application_id ? { ...x, my_stars: n } : x)))}
      />
    </View>
  );
}

const s = themed((colors) => ({
  hero: { paddingVertical: 8, marginBottom: 12 },
  catIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  kpi: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  list: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, marginBottom: 12, overflow: 'hidden' },
  applicant: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
}));
