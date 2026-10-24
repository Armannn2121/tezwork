import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { ALL_CITIES, CityPickerModal } from '../../components/city-picker';
import { ShiftCard } from '../../components/shift-card';
import { cityName } from '../../lib/cities';
import { humanError, isIinMissing } from '../../lib/errors';
import { useFeedback } from '../../lib/feedback';
import { dayOffset, firstName, formatKzt, hourlyRate, shiftWhen, ts } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { patchShift, putBizShifts, putOpenShifts } from '../../lib/shift-cache';
import { supabase } from '../../lib/supabase';
import { colors, radius, themed } from '../../lib/theme';
import { BizShift, categories, OpenShift } from '../../lib/types';
import { Badge, Button, CardSkeletons, Chips, EmptyState, ErrorBanner, Segmented, Stat, text } from '../../lib/ui';
import { useFocusQuery } from '../../lib/use-focus-query';
import { useIinGate } from '../../lib/use-iin-gate';
import { useNow } from '../../lib/use-now';

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
  const iinGate = useIinGate();
  const [city, setCity] = useState(profile?.city ?? ALL_CITIES);
  const [cityOpen, setCityOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [day, setDay] = useState<DayFilter>('all');
  const [category, setCategory] = useState(ALL);
  const [sort, setSort] = useState<Sort>('soon');
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useFocusQuery<OpenShift[]>(
    `open:${city}`,
    () => supabase.rpc('list_open_shifts', { p_city: city || null }),
    (d) => putOpenShifts(d ?? []),
  );

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (q.data ?? []).filter((s) => {
      if (category !== ALL && s.category !== category) return false;
      if (needle && ![s.title, s.company_name, s.address].some((v) => v?.toLowerCase().includes(needle))) return false;
      const off = dayOffset(s.starts_at);
      if (day === 'today') return off === 0;
      if (day === 'tomorrow') return off === 1;
      if (day === 'week') return off >= 0 && off < 7;
      return true;
    });
    return list.sort((a, b) => sort === 'rate'
      ? hourlyRate(b.pay_kzt, b.starts_at, b.ends_at) - hourlyRate(a.pay_kzt, a.starts_at, a.ends_at)
      : ts(a.starts_at) - ts(b.starts_at));
  }, [q.data, category, day, sort, query]);

  async function apply(s: OpenShift) {
    if (!(await iinGate())) return;
    const ok = await confirm({
      title: t('feed.applyTitle'),
      message: t('feed.applyMsg', { title: s.title, when: shiftWhen(s.starts_at, s.ends_at), pay: formatKzt(s.pay_kzt) }),
      confirm: t('feed.apply'),
      cancel: t('common.cancel'),
    });
    if (!ok) return;
    setBusyId(s.id);
    const { error } = await supabase.rpc('apply_to_shift', { p_shift_id: s.id });
    setBusyId(null);
    if (error) {
      if (isIinMissing(error)) { await iinGate(true); return; }
      return toast(humanError(error), 'error');
    }
    // Тізімді күтпей-ақ жаңартамыз
    q.setData((d) => (d ?? []).map((x) => (x.id === s.id ? { ...x, applied: true, spots_left: x.spots_left - 1 } : x)));
    patchShift(s.id, { applied: true, spots_left: s.spots_left - 1 });
    toast(t('feed.appliedToast'), 'success');
    q.reload();
  }

  const filtered = category !== ALL || day !== 'all' || !!query || city !== (profile?.city ?? ALL_CITIES);

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[text.muted, { fontSize: 15 }]}>{t('feed.hello', { name: firstName(profile?.full_name) })}</Text>
        <Pressable onPress={() => setCityOpen(true)} style={s.cityPill}>
          <Ionicons name="location" size={14} color={colors.brand} />
          <Text style={s.cityText} numberOfLines={1}>{city ? cityName(city) : t('common.allCities')}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.muted} />
        </Pressable>
      </View>
      <Text style={[text.h2, { marginBottom: 14, marginTop: 2 }]}>{t('feed.title')}</Text>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={colors.faint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('feed.searchPh')}
          placeholderTextColor={colors.faint}
          style={s.searchInput}
          returnKeyType="search"
        />
        {!!query && <Ionicons name="close-circle" size={18} color={colors.faint} onPress={() => setQuery('')} />}
      </View>
      <Segmented
        options={[
          { id: 'all', label: t('common.all') }, { id: 'today', label: t('time.today') },
          { id: 'tomorrow', label: t('time.tomorrow') }, { id: 'week', label: t('feed.week') },
        ]}
        value={day}
        onChange={setDay}
      />
      <Chips scroll options={[{ id: ALL, label: t('common.all') }, ...categories()]} value={category} onChange={setCategory} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={text.muted}>{q.loading ? t('common.loading') : t('feed.found', { n: items.length })}</Text>
        <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13 }} onPress={() => setSort(sort === 'soon' ? 'rate' : 'soon')}>
          {sort === 'soon' ? t('feed.sortSoon') : t('feed.sortRate')}
        </Text>
      </View>
      {q.error && <ErrorBanner message={q.error} onRetry={q.reload} />}
      <CityPickerModal visible={cityOpen} value={city} onChange={setCity} onClose={() => setCityOpen(false)} allowAll />
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}
      data={q.loading ? [] : items}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={q.refreshing} tintColor={colors.brand} onRefresh={q.refresh} />}
      ListEmptyComponent={q.loading ? <CardSkeletons /> : (
        <EmptyState
          icon="search-outline"
          title={t('feed.emptyTitle')}
          subtitle={t('feed.emptySub')}
          action={filtered
            ? { title: t('feed.clearFilters'), onPress: () => { setCategory(ALL); setDay('all'); setQuery(''); setCity(ALL_CITIES); } }
            : undefined}
        />
      )}
      renderItem={({ item: s }) => (
        <ShiftCard
          shift={s}
          showProgress
          onPress={() => router.push({ pathname: '/shift/[id]', params: { id: s.id } })}
          badges={<>
            {s.applied && <Badge label={t('feed.applied')} icon="checkmark-circle" tone="brand" />}
            {!s.applied && s.spots_left > 0 && s.spots_left <= 2 && <Badge label={t('feed.spotsLeft', { n: s.spots_left })} icon="flame" tone="warn" />}
          </>}
          footer={s.applied ? null : (
            <Button
              title={s.spots_left > 0 ? t('feed.apply') : t('feed.noSpots')}
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
      <Text style={[text.h2, { marginBottom: 14 }]}>{t('biz.title')}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Stat icon="briefcase-outline" label={t('biz.active')} value={String(active.length)} />
        <Stat icon="people-outline" label={t('biz.taken')} value={String(taken)} />
        <Stat icon="person-add-outline" label={t('biz.free')} value={String(free)} />
      </View>
      <Button title={t('biz.newShift')} icon="add" onPress={() => router.push('/create')} style={{ marginBottom: 14 }} />
      <Segmented
        options={[{ id: 'active', label: t('biz.tabActive', { n: active.length }) }, { id: 'past', label: t('biz.tabArchive', { n: past.length }) }]}
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
          title={tab === 'active' ? t('biz.emptyActive') : t('biz.emptyArchive')}
          subtitle={tab === 'active' ? t('biz.emptyActiveSub') : t('biz.emptyArchiveSub')}
        />
      )}
      renderItem={({ item: s }) => (
        <ShiftCard
          shift={s}
          showProgress
          onPress={() => router.push({ pathname: '/shift/[id]', params: { id: s.id } })}
          badges={<>
            {s.status !== 'open' && <Badge label={t('biz.closed')} icon="lock-closed" tone="neutral" />}
            {s.status === 'open' && ended(s) && <Badge label={t('biz.ended')} tone="neutral" />}
            {s.status === 'open' && s.taken >= s.spots && !ended(s) && <Badge label={t('biz.full')} icon="checkmark-done" tone="brand" />}
          </>}
        />
      )}
    />
  );
}

const s = themed((c) => ({
  cityPill: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 170, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  cityText: { color: c.text, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 11, outlineStyle: 'none' } as never,
}));
