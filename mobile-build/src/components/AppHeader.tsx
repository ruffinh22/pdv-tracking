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
    backgroundColor: '#f8f7ff',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[100],
  },
  title: { color: colors.ink[900], fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.ink[500], fontSize: 11.5, marginTop: 2 },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  syncText: { color: colors.primary[700], fontSize: 11.5, fontWeight: '700' },
});
