import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { humanError } from '../lib/errors';
import { useFeedback } from '../lib/feedback';
import { t } from '../lib/i18n';
import {
  BANKS, cardBrand, cardDigits, isValidCard, isValidKzIban, maskCardInput, maskIbanInput, methodLabel, normalizeIban, OTHER_BANK,
} from '../lib/payments';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { colors, radius, themed } from '../lib/theme';
import { PaymentMethod } from '../lib/types';
import { useFocusQuery } from '../lib/use-focus-query';
import { Button, Chips, EmptyState, ErrorBanner, Field, SectionTitle, Segmented, Skeleton, text } from '../lib/ui';

type Kind = 'card' | 'iban';

export default function PaymentMethods() {
  const { profile } = useSession();
  const { toast, confirm } = useFeedback();
  const q = useFocusQuery<PaymentMethod[]>('payment-methods', () =>
    supabase.from('payment_methods').select('*').order('created_at', { ascending: false }));

  const [kind, setKind] = useState<Kind>('card');
  const [card, setCard] = useState('');
  const [iban, setIban] = useState('');
  const [holder, setHolder] = useState(profile?.full_name ?? '');
  const [bank, setBank] = useState(BANKS[0]);
  const [otherBank, setOtherBank] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'card' | 'iban' | 'holder', string>>>({});
  const [busy, setBusy] = useState(false);

  async function add() {
    const e: typeof errors = {};
    if (kind === 'card' && !isValidCard(card)) e.card = t('pm.cardErr');
    if (kind === 'iban' && !isValidKzIban(iban)) e.iban = t('pm.ibanErr');
    if (holder.trim().length < 2) e.holder = t('pm.holderErr');
    setErrors(e);
    if (Object.keys(e).length) return;
    const bankName = bank === OTHER_BANK ? otherBank.trim() || t('pm.bankOther') : bank;
    setBusy(true);
    // Картаның толық нөмірі серверге жіберілмейді — тек соңғы 4 цифры мен түрі
    const row: Record<string, string> = kind === 'card'
      ? { kind, bank: bankName, holder: holder.trim(), card_last4: cardDigits(card).slice(-4), card_brand: cardBrand(card) }
      : { kind, bank: bankName, holder: holder.trim(), iban: normalizeIban(iban) };
    // Қосылған жолды бірден қайтарамыз — тізімді қайта жүктемейміз
    const { data, error } = await supabase.from('payment_methods').insert(row).select().single();
    setBusy(false);
    if (error) return toast(humanError(error), 'error');
    q.setData((list) => [data as PaymentMethod, ...(list ?? [])]);
    setCard(''); setIban('');
    toast(t('pm.added'), 'success');
  }

  async function remove(m: PaymentMethod) {
    const ok = await confirm({ title: t('pm.deleteTitle'), message: `${methodLabel(m)}\n${t('pm.deleteMsg')}`, confirm: t('pm.deleteTitle'), cancel: t('common.cancel'), destructive: true });
    if (!ok) return;
    const { error } = await supabase.from('payment_methods').delete().eq('id', m.id);
    if (error) return toast(humanError(error), 'error');
    q.setData((list) => (list ?? []).filter((x) => x.id !== m.id));
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        {q.error && <ErrorBanner message={q.error} onRetry={q.reload} />}
        {q.loading ? <Skeleton height={64} style={{ marginBottom: 12 }} /> : (q.data ?? []).length === 0 ? (
          <EmptyState icon="card-outline" title={t('pm.empty')} />
        ) : (
          (q.data ?? []).map((m) => (
            <View key={m.id} style={s.method}>
              <View style={s.methodIcon}>
                <Ionicons name={m.kind === 'card' ? 'card' : 'business'} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={text.title}>{methodLabel(m)}</Text>
                <Text style={text.muted}>{m.bank} · {m.holder}</Text>
              </View>
              <Pressable accessibilityLabel={t('pm.deleteTitle')} onPress={() => remove(m)} hitSlop={10}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          ))
        )}

        <SectionTitle>{t('pm.addNew')}</SectionTitle>
        <Segmented options={[{ id: 'card', label: t('pm.card') }, { id: 'iban', label: t('pm.iban') }]} value={kind} onChange={(k) => { setKind(k); setErrors({}); }} />
        {kind === 'card' ? (
          <Field
            label={t('pm.cardNumber')}
            value={maskCardInput(card)}
            onChangeText={(v) => { setCard(cardDigits(v)); setErrors({ ...errors, card: undefined }); }}
            keyboardType="number-pad"
            placeholder="0000 0000 0000 0000"
            maxLength={23}
            error={errors.card}
            hint={t('pm.cardNote')}
          />
        ) : (
          <Field
            label="IBAN"
            value={maskIbanInput(iban)}
            onChangeText={(v) => { setIban(normalizeIban(v)); setErrors({ ...errors, iban: undefined }); }}
            autoCapitalize="characters"
            placeholder="KZ00 0000 0000 0000 0000"
            maxLength={24}
            error={errors.iban}
          />
        )}
        <Field
          label={t('pm.holder')}
          value={holder}
          onChangeText={(v) => { setHolder(v); setErrors({ ...errors, holder: undefined }); }}
          autoCapitalize="characters"
          error={errors.holder}
        />
        <Chips
          label={t('pm.bank')}
          options={[...BANKS.map((b) => ({ id: b, label: b })), { id: OTHER_BANK, label: t('pm.bankOther') }]}
          value={bank}
          onChange={setBank}
        />
        {bank === OTHER_BANK && <Field label={t('pm.bank')} value={otherBank} onChangeText={setOtherBank} />}
        <Button title={t('pm.add')} icon="add" onPress={add} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = themed((c) => ({
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  methodIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' },
}));
