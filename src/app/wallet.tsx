import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { humanError } from '../lib/errors';
import { useFeedback } from '../lib/feedback';
import { dayLabel, formatKzt, formatTime } from '../lib/format';
import { t, TKey } from '../lib/i18n';
import { methodLabel } from '../lib/payments';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { colors, radius, themed } from '../lib/theme';
import { IconName, PaymentMethod, WalletSummary, WalletTx } from '../lib/types';
import { useFocusQuery } from '../lib/use-focus-query';
import { Button, Chips, EmptyState, ErrorBanner, Field, SectionTitle, Stat, text } from '../lib/ui';

type Action = 'topup' | 'withdraw';

const TX_ICON: Record<WalletTx['kind'], IconName> = {
  topup: 'add-circle', withdraw: 'arrow-up-circle', earning: 'cash', payment: 'briefcase',
};

export default function Wallet() {
  const router = useRouter();
  const { profile } = useSession();
  const { toast } = useFeedback();
  const isBiz = profile?.role === 'business';
  const [action, setAction] = useState<Action | null>(null);

  const summary = useFocusQuery<WalletSummary[]>('wallet-summary', () => supabase.rpc('my_wallet'));
  const txs = useFocusQuery<WalletTx[]>('wallet-tx', () =>
    supabase.from('wallet_tx').select('id, amount, kind, status, created_at, is_test').order('created_at', { ascending: false }).limit(100));
  const methods = useFocusQuery<PaymentMethod[]>('wallet-methods', () =>
    supabase.from('payment_methods').select('*').order('created_at', { ascending: false }));

  const w = summary.data?.[0];
  const refresh = () => { summary.refresh(); txs.reload(); methods.reload(); };

  const header = (
    <View>
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>{t('wallet.balance')}</Text>
        <Text style={s.balance}>{formatKzt(w?.balance ?? 0)}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          {isBiz && <Button title={t('wallet.topup')} icon="add" onPress={() => setAction('topup')} style={{ flex: 1 }} />}
          <Button title={t('wallet.withdraw')} icon="arrow-up" variant={isBiz ? 'secondary' : 'primary'} onPress={() => setAction('withdraw')} style={{ flex: 1 }} />
        </View>
      </View>

      <View style={s.testBanner}>
        <Ionicons name="flask-outline" size={18} color={colors.info} />
        <Text style={{ color: colors.text, flex: 1, fontSize: 13, lineHeight: 18 }}>{t('wallet.test')}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
        {isBiz
          ? <Stat icon="briefcase-outline" label={t('wallet.spent')} value={formatKzt(w?.spent ?? 0)} />
          : <Stat icon="cash-outline" label={t('wallet.earned')} value={formatKzt(w?.earned ?? 0)} />}
        <Stat icon="card-outline" label={t('profile.payment')} value={String(methods.data?.length ?? 0)} />
      </View>
      <Text style={[text.muted, { marginVertical: 8, lineHeight: 19 }]}>{isBiz ? t('wallet.howBiz') : t('wallet.howWorker')}</Text>
      <Button title={t('pm.title')} icon="card-outline" variant="secondary" size="sm" onPress={() => router.push('/payment-methods')} />

      {(summary.error || txs.error) && <ErrorBanner message={(summary.error || txs.error) as string} onRetry={refresh} />}
      <SectionTitle>{t('wallet.history')}</SectionTitle>
    </View>
  );

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' }}
        data={txs.data ?? []}
        keyExtractor={(x) => x.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={summary.refreshing} tintColor={colors.brand} onRefresh={refresh} />}
        ListEmptyComponent={txs.loading ? undefined : <EmptyState icon="receipt-outline" title={t('wallet.empty')} />}
        renderItem={({ item: x }) => (
          <View style={s.tx}>
            <View style={[s.txIcon, { backgroundColor: x.amount > 0 ? colors.brandSoft : colors.cardAlt }]}>
              <Ionicons name={TX_ICON[x.kind]} size={18} color={x.amount > 0 ? colors.brand : colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={text.body}>{t(`wallet.kind.${x.kind}` as TKey)}</Text>
              <Text style={[text.muted, { fontSize: 12 }]}>{dayLabel(x.created_at)} · {formatTime(x.created_at)}</Text>
            </View>
            <Text style={{ fontWeight: '800', fontSize: 15, color: x.amount > 0 ? colors.brand : colors.text }}>
              {x.amount > 0 ? '+' : '−'}{formatKzt(Math.abs(x.amount))}
            </Text>
          </View>
        )}
      />
      <AmountModal
        action={action}
        methods={(methods.data ?? []).filter((m) => action !== 'topup' || m.kind === 'card')}
        balance={w?.balance ?? 0}
        onClose={() => setAction(null)}
        onAddMethod={() => { setAction(null); router.push('/payment-methods'); }}
        onDone={(msg) => { setAction(null); toast(msg, 'success'); refresh(); }}
        onError={(msg) => toast(msg, 'error')}
      />
    </>
  );
}

function AmountModal({ action, methods, balance, onClose, onAddMethod, onDone, onError }: {
  action: Action | null; methods: PaymentMethod[]; balance: number;
  onClose: () => void; onAddMethod: () => void; onDone: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = methodId ?? methods[0]?.id ?? null;
  const isTopup = action === 'topup';

  const close = () => { setAmount(''); setError(null); setMethodId(null); onClose(); };

  async function submit() {
    const n = parseInt(amount, 10) || 0;
    if (n < 1000) return setError(t('wallet.amountErr'));
    if (!selected) return;
    setBusy(true);
    const { error: e } = await supabase.rpc(isTopup ? 'wallet_topup' : 'wallet_withdraw', { p_amount: n, p_method_id: selected });
    setBusy(false);
    if (e) return onError(humanError(e));
    setAmount(''); setMethodId(null);
    onDone(isTopup ? t('wallet.topupDone') : t('wallet.withdrawDone'));
  }

  return (
    <Modal transparent visible={!!action} animationType="fade" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={[text.h2, { marginBottom: 4 }]}>{isTopup ? t('wallet.topup') : t('wallet.withdraw')}</Text>
          {!isTopup && <Text style={[text.muted, { marginBottom: 12 }]}>{t('wallet.balance')}: {formatKzt(balance)}</Text>}
          {methods.length === 0 ? (
            <>
              <Text style={[text.body, { marginVertical: 12 }]}>{isTopup ? t('wallet.needCard') : t('wallet.noMethods')}</Text>
              <Button title={t('pm.addNew')} icon="add" onPress={onAddMethod} />
            </>
          ) : (
            <>
              <Field
                label={t('wallet.amount')}
                value={amount}
                onChangeText={(v) => { setAmount(v.replace(/\D/g, '').slice(0, 7)); setError(null); }}
                keyboardType="number-pad"
                placeholder="10000"
                error={error}
                autoFocus
              />
              <Chips
                label={isTopup ? t('wallet.fromCard') : t('wallet.toCard')}
                options={methods.map((m) => ({ id: m.id, label: `${m.bank} · ${methodLabel(m)}` }))}
                value={selected ?? ''}
                onChange={setMethodId}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title={t('common.cancel')} variant="ghost" onPress={close} style={{ flex: 1 }} />
                <Button title={isTopup ? t('wallet.topup') : t('wallet.withdraw')} onPress={submit} loading={busy} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = themed((c) => ({
  balanceCard: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, padding: 18, marginBottom: 12 },
  balanceLabel: { color: c.muted, fontSize: 13, fontWeight: '600' },
  balance: { color: c.text, fontSize: 34, fontWeight: '800', marginTop: 4 },
  testBanner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: c.infoSoft, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: c.card, borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: c.border, maxWidth: 460, width: '100%', alignSelf: 'center' },
}));
