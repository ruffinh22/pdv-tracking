import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from './Card';
import { colors } from '@/theme/colors';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  hint?: string;
}

const toneColor: Record<string, string> = {
  primary: colors.primary[600],
  success: colors.success[600],
  warning: colors.warning[600],
  danger: colors.danger[600],
};

export default function StatCard({ label, value, icon, tone = 'primary', hint }: StatCardProps) {
  return (
    <Card style={styles.card}>
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
  card: { flex: 1, minWidth: '46%' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink[500], flexShrink: 1 },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 26, fontWeight: '800', marginTop: 10 },
  hint: { fontSize: 12, color: colors.ink[400], marginTop: 4 },
});
