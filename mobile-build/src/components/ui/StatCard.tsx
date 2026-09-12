import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Card from './Card';
import AnimatedNumber from './AnimatedNumber';
import { colors, radius } from '@/theme/colors';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  hint?: string;
  style?: ViewStyle;
  delay?: number;
}

const toneColor: Record<string, string> = {
  primary: colors.primary[600],
  success: colors.success[600],
  warning: colors.warning[600],
  danger: colors.danger[600],
};

export default function StatCard({ label, value, icon, tone = 'primary', hint, style, delay = 0 }: StatCardProps) {
  const isNumeric = typeof value === 'number';

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420).springify().damping(16)} style={{ flex: 1 }}>
      <Card style={[styles.card, style]}>
        <View style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          {icon ? <View style={[styles.iconWrap, { backgroundColor: `${toneColor[tone]}1A` }]}>{icon}</View> : null}
        </View>
        {isNumeric ? (
          <AnimatedNumber value={value as number} style={[styles.value, { color: toneColor[tone] }]} />
        ) : (
          <Text style={[styles.value, { color: toneColor[tone] }]}>{value}</Text>
        )}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    minHeight: 84,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderColor: colors.ink[200],
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ink[500],
    flexShrink: 1,
    lineHeight: 14,
    maxWidth: '80%',
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: -0.5,
  },
  hint: {
    fontSize: 11,
    color: colors.ink[500],
    marginTop: 3,
    lineHeight: 13,
  },
});
