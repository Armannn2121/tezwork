import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { AI_ERROR_KEY, AI_FIELD_KEY, draftShift, ShiftDraft } from '../lib/ai';
import { t } from '../lib/i18n';
import { colors, radius, themed } from '../lib/theme';
import { Button } from '../lib/ui';

// Жариялау формасының басындағы блок: еркін мәтін → AI → форма өрістері
export function AiAssist({ onDraft }: { onDraft: (d: ShiftDraft) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  async function run() {
    setBusy(true); setError(null); setMissing([]);
    const res = await draftShift(text);
    setBusy(false);
    if ('error' in res) return setError(t(AI_ERROR_KEY[res.error]));
    setMissing(res.draft.missing);
    onDraft(res.draft);
  }

  return (
    <View style={s.box}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="sparkles" size={18} color={colors.brand} />
        <Text style={s.title}>{t('ai.title')}</Text>
        <Text accessibilityRole="button" style={s.example} onPress={() => { setText(t('ai.exampleText')); setError(null); }}>
          {t('ai.example')}
        </Text>
      </View>
      <Text style={s.hint}>{t('ai.hint')}</Text>
      <TextInput
        value={text}
        onChangeText={(v) => { setText(v); setError(null); }}
        placeholder={t('ai.ph')}
        placeholderTextColor={colors.faint}
        style={s.input}
        multiline
        maxLength={800}
        editable={!busy}
      />
      {error && <Text style={s.error}>{error}</Text>}
      {missing.length > 0 && !error && (
        <Text style={s.missing}>{t('ai.missing', { fields: missing.map((f) => t(AI_FIELD_KEY[f] ?? 'create.title').toLowerCase()).join(', ') })}</Text>
      )}
      <Button
        title={busy ? t('ai.thinking') : t('ai.fill')}
        icon="sparkles"
        onPress={run}
        loading={busy}
        disabled={text.trim().length < 8}
        style={{ marginTop: 10 }}
      />
    </View>
  );
}

const s = themed((c) => ({
  box: { backgroundColor: c.brandSoft, borderColor: c.brand, borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 16 },
  title: { color: c.text, fontWeight: '800', fontSize: 16, flex: 1 },
  example: { color: c.brand, fontWeight: '700', fontSize: 13 },
  hint: { color: c.muted, fontSize: 13, marginTop: 4, marginBottom: 10, lineHeight: 18 },
  input: { minHeight: 84, color: c.text, fontSize: 15, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, padding: 12, textAlignVertical: 'top', outlineStyle: 'none' } as never,
  error: { color: c.danger, marginTop: 8, fontWeight: '600' },
  missing: { color: c.warn, marginTop: 8, fontWeight: '600', lineHeight: 19 },
}));
