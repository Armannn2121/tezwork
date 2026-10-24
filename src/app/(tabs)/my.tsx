import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { ShiftCard } from '../../components/shift-card';
import { humanError } from '../../lib/errors';
import { useFeedback } from '../../lib/feedback';
import { formatKzt, timeUntil, ts } from '../../lib/format';
import { putApplications } from '../../lib/shift-cache';
import { supabase } from '../../lib/supabase';
import { APPLICATION_STATUS, MyApplication } from '../../lib/types';
import { useFocusQuery } from '../../lib/use-focus-query';
import { useNow } from '../../lib/use-now';
import { Badge, Button, CardSkeletons, colors, EmptyState, ErrorBanner, Segmented, Stat, text } from '../../lib/ui';

type Tab = 'upcoming' | 'history';

export default function MyApplications() {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const [tab, setTab] = useState<Tab>('upcoming');
  const q = useFocusQuery<MyApplication[]>('my-apps', () => supabase.rpc('my_applications'), (d) => putApplications(d ?? []));

  const now = useNow();
  const all = q.data ?? [];
  const isUpcoming = (a: MyApplication) => a.status !== 'cancelled' && a.status !== 'completed' && ts(a.ends_at) > now;
  const upcoming = all.filter(isUpcoming).sort((a, b) => ts(a.starts_at) - ts(b.starts_at));
  const history = all.filter((a) => !isUpcoming(a)).sort((a, b) => ts(b.starts_at) - ts(a.starts_at));
  const completed = all.filter((a) => a.status === 'completed');
  const earned = completed.reduce((n, a) => n + a.pay_kzt, 0);
  const expected = upcoming.reduce((n, a) => n + a.pay_kzt, 0);
  const next = upcoming[0];

  async function cancel(a: MyApplication) {
    const ok = await confirm({
      title: 'Жазылудан бас тарту',
      message: 'Орныңыз босап, басқа жұмысшыларға қолжетімді болады.',
      confirm: 'Бас тарту', cancel: 'Қалдыру', destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc('cancel_application', { p_application_id: a.application_id });
    if (error) return toast(humanError(error), 'error');
    toast('Жазылудан бас тарттыңыз', 'info');
    q.reload();
  }

  const header = (
    <View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Stat icon="wallet-outline" label="Табыс" value={formatKzt(earned)} />
        <Stat icon="hourglass-outline" label="Күтілуде" value={formatKzt(expected)} />
        <Stat icon="checkmark-done-outline" label="Ауысым" value={String(completed.length)} />
      </View>
      {next && (
        <View style={{ backgroundColor: colors.brandSoft, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <Text style={{ color: colors.brand, fontWeight: '800' }}>Келесі ауысым {timeUntil(next.starts_at, new Date(now))}</Text>
          <Text style={[text.body, { marginTop: 2 }]} numberOfLines={1}>{next.title} · {next.company_name}</Text>
        </View>
      )}
      <Segmented
        options={[{ id: 'upcoming', label: `Алдағы (${upcoming.length})` }, { id: 'history', label: `Тарих (${history.length})` }]}
        value={tab}
        onChange={setTab}
      />
      {q.error && <ErrorBanner message={q.error} onRetry={q.reload} />}
    </View>
  );

  return (
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
          title={tab === 'upcoming' ? 'Алдағы ауысым жоқ' : 'Тарих бос'}
          subtitle={tab === 'upcoming' ? 'Ыңғайлы ауысымды тауып, бір түртумен жазылыңыз' : 'Аяқталған ауысымдарыңыз осында шығады'}
          action={tab === 'upcoming' ? { title: 'Жұмыс іздеу', onPress: () => router.navigate('/') } : undefined}
        />
      )}
      renderItem={({ item: a }) => {
        const st = APPLICATION_STATUS[a.status] ?? { label: a.status, tone: 'neutral' as const };
        return (
          <ShiftCard
            shift={{ id: a.shift_id, title: a.title, city: a.city, address: a.address, starts_at: a.starts_at, ends_at: a.ends_at, pay_kzt: a.pay_kzt, company_name: a.company_name }}
            onPress={() => router.push({ pathname: '/shift/[id]', params: { id: a.shift_id } })}
            badges={<Badge label={st.label} tone={st.tone} />}
            footer={a.status === 'confirmed' && ts(a.starts_at) > now
              ? <Button title="Бас тарту" variant="ghost" size="sm" onPress={() => cancel(a)} />
              : null}
          />
        );
      }}
    />
  );
}
