import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { formatHours, formatKzt, hourlyRate, hoursBetween, isNightShift, shiftWhen } from '../lib/format';
import { categoryOf, ShiftView } from '../lib/types';
import { Badge, Card, colors, IconText, Progress, text } from '../lib/ui';

export function ShiftCard({ shift: s, onPress, badges, footer, showProgress }: {
  shift: ShiftView; onPress?: () => void; badges?: ReactNode; footer?: ReactNode; showProgress?: boolean;
}) {
  const cat = categoryOf(s.category);
  const hours = hoursBetween(s.starts_at, s.ends_at);
  const filled = s.spots ? (s.taken ?? s.spots - (s.spots_left ?? s.spots)) / s.spots : 0;
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={cat.icon} size={21} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={text.title} numberOfLines={2}>{s.title}</Text>
          {!!s.company_name && <Text style={text.muted} numberOfLines={1}>{s.company_name}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={text.price}>{formatKzt(s.pay_kzt)}</Text>
          <Text style={{ color: colors.faint, fontSize: 12 }}>{formatKzt(hourlyRate(s.pay_kzt, s.starts_at, s.ends_at))}/сағ</Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <IconText icon="time-outline" color={colors.text}>{shiftWhen(s.starts_at, s.ends_at)} · {formatHours(hours)}</IconText>
        <IconText icon="location-outline">{s.city}{s.address ? `, ${s.address}` : ''}</IconText>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {isNightShift(s.starts_at, s.ends_at) && <Badge label="Түнгі" icon="moon" tone="info" />}
        {badges}
      </View>

      {showProgress && s.spots ? (
        <View>
          <Progress value={filled} />
          <Text style={{ color: colors.faint, fontSize: 12, marginTop: 6 }}>
            {s.taken ?? s.spots - (s.spots_left ?? 0)} / {s.spots} орын толды
          </Text>
        </View>
      ) : null}

      {footer && <View style={{ marginTop: 10 }}>{footer}</View>}
    </Card>
  );
}
