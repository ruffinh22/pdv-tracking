import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Card from './Card';
import { colors } from '@/theme/colors';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  hint?: string;
  style?: ViewStyle;
}

const toneColor: Record<string, string> = {
  primary: colors.primary[600],
  success: colors.success[600],
  warning: colors.warning[600],
  danger: colors.danger[600],
};

export default function StatCard({ label, value, icon, tone = 'primary', hint, style }: StatCardProps) {
  return (
    <Card style={[styles.card, style]}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        {icon ? <View style={[styles.iconWrap, { backgroundColor: `${toneColor[tone]}1A` }]}>{icon}</View> : null}
      </View>
      <Text style={[styles.value, { color: toneColor[tone] }]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    minHeight: 84,
    justifyContent: 'center',
    borderRadius: 10,
    borderColor: colors.ink[300],
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.ink[500],
    flexShrink: 1,
    lineHeight: 13,
    maxWidth: '80%',
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
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
    fontSize: 9.5,
    color: colors.ink[400],
    marginTop: 3,
    lineHeight: 11,
  },
});
