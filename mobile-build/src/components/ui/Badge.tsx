import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme/colors';

type Tone = 'success' | 'danger' | 'warning' | 'primary' | 'neutral';

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.success[100], fg: colors.success[700] },
  danger: { bg: colors.danger[100], fg: colors.danger[700] },
  warning: { bg: colors.warning[100], fg: colors.warning[700] },
  primary: { bg: colors.primary[100], fg: colors.primary[700] },
  neutral: { bg: colors.ink[100], fg: colors.ink[600] },
};

export default function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = toneStyles[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
