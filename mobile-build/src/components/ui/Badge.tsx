import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme/colors';
import PulseDot from './PulseDot';

type Tone = 'success' | 'danger' | 'warning' | 'primary' | 'neutral';

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.success[100], fg: colors.success[700] },
  danger: { bg: colors.danger[100], fg: colors.danger[700] },
  warning: { bg: colors.warning[100], fg: colors.warning[700] },
  primary: { bg: colors.primary[100], fg: colors.primary[800] },
  neutral: { bg: colors.ink[100], fg: colors.ink[600] },
};

export default function Badge({
  label,
  tone = 'neutral',
  pulse = false,
}: {
  label: string;
  tone?: Tone;
  pulse?: boolean;
}) {
  const t = toneStyles[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {pulse ? (
        <View style={{ marginRight: 6 }}>
          <PulseDot color={t.fg} size={6} />
        </View>
      ) : null}
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  text: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.2 },
});
