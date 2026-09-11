import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { useApp } from '@/context/AppContext';

export default function AppHeader({ subtitle }: { subtitle?: string }) {
  const { syncNow, syncStatus, pendingVentes } = useApp();

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>Tracking PDV</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <TouchableOpacity style={styles.syncButton} onPress={syncNow} activeOpacity={0.85}>
        {syncStatus === 'syncing' ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="sync" size={16} color="#fff" />
        )}
        <Text style={styles.syncText}>
          {syncStatus === 'syncing' ? 'Sync…' : pendingVentes.length > 0 ? `Sync (${pendingVentes.length})` : 'Sync'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.ink[950],
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary[600],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  syncText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
