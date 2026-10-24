import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { ShiftCard } from '../../components/shift-card';
import { humanError } from '../../lib/errors';
import { useFeedback } from '../../lib/feedback';
import { dayOffset, firstName, formatKzt, hourlyRate, shiftWhen, ts } from '../../lib/format';
import { useSession } from '../../lib/session';
import { patchShift, putBizShifts, putOpenShifts } from '../../lib/shift-cache';
import { supabase } from '../../lib/supabase';
import { BizShift, CATEGORIES, CITIES, OpenShift } from '../../lib/types';
import { useFocusQuery } from '../../lib/use-focus-query';
import { useNow } from '../../lib/use-now';
import { Badge, Button, CardSkeletons, Chips, colors, EmptyState, ErrorBanner, Segmented, Stat, text } from '../../lib/ui';

export default function Home() {
  const { profile } = useSession();
  return profile?.role === 'business' ? <BusinessShifts /> : <WorkerFeed />;
}

// ---------------- ОРЫНДАУШЫ: ашық ауысымдар ----------------
type DayFilter = 'all' | 'today' | 'tomorrow' | 'week';
type Sort = 'soon' | 'rate';
const ALL = 'all';

function WorkerFeed() {
  const router = useRouter();
  const { profile } = useSession();
  const { toast, confirm } = useFeedback();
  const [city, setCity] = useState(profile?.city ?? CITIES[0]);
  const [day, setDay] = useState<DayFilter>('all');
  const [category, setCategory] = useState(ALL);
  const [sort, setSort] = useState<Sort>('soon');
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useFocusQuery<OpenShift[]>(
    `open:${city}`,
    () => supabase.rpc('list_open_shifts', { p_city: city === ALL ? null : city }),
    (d) => putOpenShifts(d ?? []),
  );

  const items = useMemo(() => {
    const list = (q.data ?? []).filter((s) => {
      if (category !== ALL && s.category !== category) return false;
      const off = dayOffset(s.starts_at);
      if (day === 'today') return off === 0;
      if (day === 'tomorrow') return off === 1;
      if (day === 'week') return off >= 0 && off < 7;
      return true;
    });
    return list.sort((a, b) => sort === 'rate'
      ? hourlyRate(b.pay_kzt, b.starts_at, b.ends_at) - hourlyRate(a.pay_kzt, a.starts_at, a.ends_at)
      : ts(a.starts_at) - ts(b.starts_at));
  }, [q.data, category, day, sort]);

  async function apply(s: OpenShift) {
    const ok = await confirm({
      title: 'Ауысымға жазылу',
      message: `${s.title}\n${shiftWhen(s.starts_at, s.ends_at)}\nТөлем: ${formatKzt(s.pay_kzt)}`,
      confirm: 'Жазылу',
    });
    if (!ok) return;
    setBusyId(s.id);
    const { error } = await supabase.rpc('apply_to_shift', { p_shift_id: s.id });
    setBusyId(null);
    if (error) return toast(humanError(error), 'error');
    // Тізімді күтпей-ақ жаңартамыз
    q.setData((d) => (d ?? []).map((x) => (x.id === s.id ? { ...x, applied: true, spots_left: x.spots_left - 1 } : x)));
    patchShift(s.id, { applied: true, spots_left: s.spots_left - 1 });
    toast('Жазылдыңыз! «Жазылымдарым» бөлімінен көріңіз', 'success');
    q.reload();
  }

  const header = (
    <View>
      <Text style={[text.muted, { fontSize: 15 }]}>Сәлем, {firstName(profile?.full_name)} 👋</Text>
      <Text style={[text.h2, { marginBottom: 14 }]}>Бүгін қай ауысымды аласыз?</Text>
      <Chips
        scroll
        options={[{ id: ALL, label: 'Барлық қала' }, ...CITIES.map((c) => ({ id: c, label: c }))]}
        value={city}
        onChange={setCity}
      />
      <Segmented
        options={[{ id: 'all', label: 'Барлығы' }, { id: 'today', label: 'Бүгін' }, { id: 'tomorrow', label: 'Ертең' }, { id: 'week', label: 'Апта' }]}
        value={day}
        onChange={setDay}
      />
      <Chips scroll options={[{ id: ALL, label: 'Барлығы' }, ...CATEGORIES]} value={category} onChange={setCategory} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={text.muted}>{q.loading ? 'Жүктелуде…' : `${items.length} ауысым табылды`}</Text>
        <Text
          style={{ color: colors.brand, fontWeight: '700', fontSize: 13 }}
          onPress={() => setSort(sort === 'soon' ? 'rate' : 'soon')}
        >
          {sort === 'soon' ? '↓ Ең жақыны' : '↓ Ең көп төлем/сағ'}
        </Text>
      </View>
      {q.error && <ErrorBanner message={q.error} onRetry={q.reload} />}
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}
      data={q.loading ? [] : items}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={q.refreshing} tintColor={colors.brand} onRefresh={q.refresh} />}
      ListEmptyComponent={q.loading ? <CardSkeletons /> : (
        <EmptyState
          icon="search-outline"
          title="Ауысым табылмады"
          subtitle="Сүзгілерді өзгертіп көріңіз немесе кейінірек қайта кіріңіз — жаңа ауысымдар күн сайын қосылады"
          action={category !== ALL || day !== 'all' || city !== ALL
            ? { title: 'Сүзгілерді тазалау', onPress: () => { setCategory(ALL); setDay('all'); setCity(ALL); } }
            : undefined}
        />
      )}
      renderItem={({ item: s }) => (
        <ShiftCard
          shift={s}
          showProgress
          onPress={() => router.push({ pathname: '/shift/[id]', params: { id: s.id } })}
          badges={<>
            {s.applied && <Badge label="Жазылғансыз" icon="checkmark-circle" tone="brand" />}
            {!s.applied && s.spots_left > 0 && s.spots_left <= 2 && <Badge label={`${s.spots_left} орын қалды`} icon="flame" tone="warn" />}
          </>}
          footer={s.applied ? null : (
            <Button
              title={s.spots_left > 0 ? 'Жазылу' : 'Орын қалмады'}
              icon={s.spots_left > 0 ? 'flash' : undefined}
              disabled={s.spots_left === 0}
              loading={busyId === s.id}
              onPress={() => apply(s)}
            />
          )}
        />
      )}
    />
  );
}

// ---------------- БИЗНЕС: өз ауысымдары ----------------
type BizTab = 'active' | 'past';

function BusinessShifts() {
  const router = useRouter();
  const { profile } = useSession();
  const [tab, setTab] = useState<BizTab>('active');
  const q = useFocusQuery<BizShift[]>('biz', () => supabase.rpc('my_business_shifts'), (d) => putBizShifts(d ?? []));

  const now = useNow();
  const ended = (s: BizShift) => ts(s.ends_at) <= now;
  const all = q.data ?? [];
  const active = all.filter((s) => s.status === 'open' && !ended(s)).sort((a, b) => ts(a.starts_at) - ts(b.starts_at));
  const past = all.filter((s) => !(s.status === 'open' && !ended(s))).sort((a, b) => ts(b.starts_at) - ts(a.starts_at));
  const items = tab === 'active' ? active : past;
  const taken = active.reduce((n, s) => n + s.taken, 0);
  const free = active.reduce((n, s) => n + Math.max(0, s.spots - s.taken), 0);

  const header = (
    <View>
      <Text style={[text.muted, { fontSize: 15 }]}>{profile?.company_name}</Text>
      <Text style={[text.h2, { marginBottom: 14 }]}>Ауысымдарды басқару</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Stat icon="briefcase-outline" label="Белсенді" value={String(active.length)} />
        <Stat icon="people-outline" label="Жазылған" value={String(taken)} />
        <Stat icon="person-add-outline" label="Бос орын" value={String(free)} />
      </View>
      <Button title="Жаңа ауысым жариялау" icon="add" onPress={() => router.push('/create')} style={{ marginBottom: 14 }} />
      <Segmented
        options={[{ id: 'active', label: `Белсенді (${active.length})` }, { id: 'past', label: `Мұрағат (${past.length})` }]}
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
      data={q.loading ? [] : items}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={q.refreshing} tintColor={colors.brand} onRefresh={q.refresh} />}
      ListEmptyComponent={q.loading ? <CardSkeletons count={2} /> : (
        <EmptyState
          icon={tab === 'active' ? 'add-circle-outline' : 'archive-outline'}
          title={tab === 'active' ? 'Белсенді ауысым жоқ' : 'Мұрағат бос'}
          subtitle={tab === 'active' ? 'Алғашқы ауысымды жариялаңыз — жұмысшылар бірден көреді' : 'Аяқталған және жабылған ауысымдар осында шығады'}
        />
      )}
      renderItem={({ item: s }) => (
        <ShiftCard
          shift={s}
          showProgress
          onPress={() => router.push({ pathname: '/shift/[id]', params: { id: s.id } })}
          badges={<>
            {s.status !== 'open' && <Badge label="Жабық" icon="lock-closed" tone="neutral" />}
            {s.status === 'open' && ended(s) && <Badge label="Аяқталды" tone="neutral" />}
            {s.status === 'open' && s.taken >= s.spots && !ended(s) && <Badge label="Толды" icon="checkmark-done" tone="brand" />}
          </>}
        />
      )}
    />
  );
}
