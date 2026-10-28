import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { RateModal } from '../../components/rating';
import { ShiftCard } from '../../components/shift-card';
import { humanError } from '../../lib/errors';
import { useFeedback } from '../../lib/feedback';
import { formatKzt, timeUntil, ts } from '../../lib/format';
import { t } from '../../lib/i18n';
import { cancelShiftReminder, syncShiftReminders } from '../../lib/reminders';
import { patchShift, putApplications } from '../../lib/shift-cache';
import { supabase } from '../../lib/supabase';
import { MyApplication, STATUS_TONE, statusLabel } from '../../lib/types';
import { useFocusQuery } from '../../lib/use-focus-query';
import { useNow } from '../../lib/use-now';
import { Badge, Button, CardSkeletons, colors, EmptyState, ErrorBanner, Segmented, Stat, text } from '../../lib/ui';

type Tab = 'upcoming' | 'history';

// Алдағы расталған ауысымдарға еске салғыштарды қалпына келтіреміз (басқа құрылғыдан жазылса да)
function onLoaded(list: MyApplication[] | null) {
  const items = list ?? [];
  putApplications(items);
  const future = items.filter((a) => ts(a.starts_at) > Date.now());
  const soon = future.filter((a) => a.status === 'confirmed');
  syncShiftReminders(soon.map((a) => ({ id: a.shift_id, title: a.title, starts_at: a.starts_at, city: a.city, address: a.address })));
  // Жұмыс беруші ауысымды жапса немесе бас тартса — еске салғыш өшуі керек
  future.filter((a) => a.status === 'cancelled' || a.status === 'rejected').forEach((a) => cancelShiftReminder(a.shift_id));
}

export default function MyApplications() {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [rateFor, setRateFor] = useState<MyApplication | null>(null);
  const q = useFocusQuery<MyApplication[]>('my-apps', () => supabase.rpc('my_applications'), onLoaded);

  const now = useNow();
  const all = q.data ?? [];
  const isUpcoming = (a: MyApplication) => (a.status === 'pending' || a.status === 'confirmed' || a.status === 'checked_in') && ts(a.ends_at) > now;
  const upcoming = all.filter(isUpcoming).sort((a, b) => ts(a.starts_at) - ts(b.starts_at));
  const history = all.filter((a) => !isUpcoming(a)).sort((a, b) => ts(b.starts_at) - ts(a.starts_at));
  const completed = all.filter((a) => a.status === 'completed');
  const earned = completed.reduce((n, a) => n + a.pay_kzt, 0);
  const expected = upcoming.filter((a) => a.status !== 'pending').reduce((n, a) => n + a.pay_kzt, 0);
  const next = upcoming[0];

  async function cancel(a: MyApplication) {
    const ok = await confirm({
      title: t('my.cancelTitle'),
      message: t('my.cancelMsg'),
      confirm: t('my.cancel'), cancel: t('my.keep'), destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc('cancel_application', { p_application_id: a.application_id });
    if (error) return toast(humanError(error), 'error');
    cancelShiftReminder(a.shift_id);
    q.setData((list) => (list ?? []).map((x) => (x.application_id === a.application_id ? { ...x, status: 'cancelled' } : x)));
    patchShift(a.shift_id, { applied: false, application_status: 'cancelled', business_phone: null });
    toast(t('my.cancelled'), 'info');
  }

  const header = (
    <View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Stat icon="wallet-outline" label={t('my.earned')} value={formatKzt(earned)} />
        <Stat icon="hourglass-outline" label={t('my.expected')} value={formatKzt(expected)} />
        <Stat icon="checkmark-done-outline" label={t('my.shifts')} value={String(completed.length)} />
      </View>
      {next && (
        <View style={{ backgroundColor: colors.brandSoft, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <Text style={{ color: colors.brand, fontWeight: '800' }}>{t('my.next', { when: timeUntil(next.starts_at, new Date(now)) })}</Text>
          <Text style={[text.body, { marginTop: 2 }]} numberOfLines={1}>{next.title} · {next.company_name}</Text>
        </View>
      )}
      <Segmented
        options={[{ id: 'upcoming', label: t('my.upcoming', { n: upcoming.length }) }, { id: 'history', label: t('my.history', { n: history.length }) }]}
        value={tab}
        onChange={setTab}
      />
      {q.error && <ErrorBanner message={q.error} onRetry={q.reload} />}
    </View>
  );

  function footer(a: MyApplication) {
    if ((a.status === 'pending' || a.status === 'confirmed') && ts(a.starts_at) > now) {
      return <Button title={t('my.cancel')} variant="ghost" size="sm" onPress={() => cancel(a)} />;
    }
    if (a.status === 'completed') {
      return a.my_stars
        ? <Text style={text.muted}>{t('rating.yours', { n: a.my_stars })}</Text>
        : <Button title={t('rating.rate')} icon="star-outline" variant="secondary" size="sm" onPress={() => setRateFor(a)} />;
    }
    return null;
  }

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}
        data={q.loading ? [] : tab === 'upcoming' ? upcoming : history}
        keyExtractor={(i) => i.application_id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={q.refreshing} tintColor={colors.brand} onRefresh={q.refresh} />}
        ListEmptyComponent={q.loading ? <CardSkeletons count={2} /> : (
          <EmptyState
            icon={tab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
            title={tab === 'upcoming' ? t('my.emptyUpcoming') : t('my.emptyHistory')}
            subtitle={tab === 'upcoming' ? t('my.emptyUpcomingSub') : t('my.emptyHistorySub')}
            action={tab === 'upcoming' ? { title: t('my.findWork'), onPress: () => router.navigate('/') } : undefined}
          />
        )}
        renderItem={({ item: a }) => (
          <ShiftCard
            shift={{
              id: a.shift_id, title: a.title, city: a.city, address: a.address, starts_at: a.starts_at, ends_at: a.ends_at,
              pay_kzt: a.pay_kzt, company_name: a.company_name, category: a.category,
              company_rating: a.company_rating, company_reviews: a.company_reviews,
            }}
            onPress={() => router.push({ pathname: '/shift/[id]', params: { id: a.shift_id } })}
            badges={<Badge label={statusLabel(a.status)} tone={STATUS_TONE[a.status] ?? 'neutral'} />}
            footer={footer(a)}
          />
        )}
      />
      <RateModal
        visible={!!rateFor}
        applicationId={rateFor?.application_id ?? null}
        title={rateFor?.company_name ?? rateFor?.title ?? ''}
        onClose={() => setRateFor(null)}
        onDone={(n) => {
          q.setData((list) => (list ?? []).map((x) => (x.application_id === rateFor?.application_id ? { ...x, my_stars: n } : x)));
          q.reload(); // компанияның жаңа рейтингі үшін
        }}
      />
    </>
  );
}
