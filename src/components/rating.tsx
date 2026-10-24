import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { humanError } from '../lib/errors';
import { useFeedback } from '../lib/feedback';
import { haptic } from '../lib/haptics';
import { t, TKey } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { colors, radius, themed } from '../lib/theme';
import { Button } from '../lib/ui';

const STAR = '#F5B301';

// «★ 4.8 (12)» — бағалар жоқ болса «Жаңа»
export function RatingBadge({ avg, count, size = 13 }: { avg?: number | null; count?: number; size?: number }) {
  if (!count) {
    return <Text style={{ color: colors.faint, fontSize: size - 1 }}>{t('rating.new')}</Text>;
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name="star" size={size} color={STAR} />
      <Text style={{ color: colors.text, fontSize: size, fontWeight: '700' }}>{Number(avg ?? 0).toFixed(1)}</Text>
      <Text style={{ color: colors.faint, fontSize: size - 1 }}>({count})</Text>
    </View>
  );
}

export function Stars({ value, onChange, size = 34 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onChange}
          accessibilityRole="button"
          accessibilityLabel={`${n}`}
          onPress={() => { haptic.select(); onChange?.(n); }}
          hitSlop={4}
        >
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? STAR : colors.faint} />
        </Pressable>
      ))}
    </View>
  );
}

const LABELS: TKey[] = ['rating.l1', 'rating.l2', 'rating.l3', 'rating.l4', 'rating.l5'];

// Баға беру терезесі. onDone — сәтті сақталғанда шақырылады
export function RateModal({ visible, applicationId, title, onClose, onDone }: {
  visible: boolean; applicationId: string | null; title: string; onClose: () => void; onDone: (stars: number) => void;
}) {
  const { toast } = useFeedback();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => { setStars(0); setComment(''); onClose(); };

  async function submit() {
    if (!applicationId || !stars) return;
    setBusy(true);
    const { error } = await supabase.rpc('rate_application', { p_application_id: applicationId, p_stars: stars, p_comment: comment || null });
    setBusy(false);
    if (error) return toast(humanError(error), 'error');
    toast(t('rating.thanks'), 'success');
    onDone(stars);
    close();
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>{t('rating.title')}</Text>
          <Text style={s.sub} numberOfLines={2}>{title}</Text>
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <Stars value={stars} onChange={setStars} />
            <Text style={[s.sub, { marginTop: 8, minHeight: 18 }]}>{stars ? t(LABELS[stars - 1]) : t('rating.tap')}</Text>
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t('rating.commentPh')}
            placeholderTextColor={colors.faint}
            style={s.input}
            multiline
            maxLength={500}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button title={t('common.cancel')} variant="ghost" onPress={close} style={{ flex: 1 }} />
            <Button title={t('rating.send')} onPress={submit} loading={busy} disabled={!stars} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = themed((c) => ({
  backdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: c.card, borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: c.border, maxWidth: 460, width: '100%', alignSelf: 'center' },
  title: { color: c.text, fontSize: 19, fontWeight: '800' },
  sub: { color: c.muted, fontSize: 14, marginTop: 4, textAlign: 'center' },
  input: { minHeight: 80, color: c.text, fontSize: 15, backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, padding: 12, textAlignVertical: 'top', outlineStyle: 'none' } as never,
}));
