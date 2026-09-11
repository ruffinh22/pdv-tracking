import React, { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { colors } from '@/theme/colors';
import StatCard from '@/components/ui/StatCard';
import GPSStatusCard from '@/components/GPSStatusCard';
import Badge from '@/components/ui/Badge';
import AppHeader from '@/components/AppHeader';

export default function HomeScreen() {
  const {
    msisdn,
    isTracking,
    currentLocation,
    initialLocation,
    pendingVentes,
    history,
    refreshLocation,
    refreshHistory,
  } = useApp();

  useEffect(() => {
    refreshLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshLocation(), refreshHistory()]);
  }, [refreshLocation, refreshHistory]);

  const today = new Date().toDateString();
  const ventesAujourdhui = history.filter((v) => new Date(v.horodatage).toDateString() === today).length;

  return (
    <View style={styles.screen}>
      <AppHeader subtitle={msisdn} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary[600]} />}
      >
        <View style={styles.statusRow}>
          <Badge
            label={isTracking ? 'Suivi GPS actif' : 'Suivi GPS inactif'}
            tone={isTracking ? 'success' : 'warning'}
          />
        </View>

        <View style={styles.featuredRow}>
          <StatCard
            label="Ventes du jour"
            value={ventesAujourdhui}
            tone="primary"
            icon={<Ionicons name="cart" size={16} color={colors.primary[600]} />}
            style={{ flex: 1, marginRight: 8 }}
          />
          <StatCard
            label="En attente de sync"
            value={pendingVentes.length}
            tone="warning"
            icon={<Ionicons name="cloud-upload" size={16} color={colors.warning[600]} />}
            style={{ flex: 1, marginLeft: 8 }}
          />
        </View>

        <View style={{ height: 8 }} />

        <View style={styles.smallRow}>
          <StatCard
            label="Total enregistré"
            value={history.length}
            tone="success"
            icon={<Ionicons name="checkmark-done" size={14} color={colors.success[600]} />}
            style={{ flex: 1, marginRight: 8 }}
          />
          <StatCard
            label="Rayon autorisé"
            value="500 m"
            tone="danger"
            icon={<Ionicons name="locate" size={14} color={colors.danger[600]} />}
            hint="Alerte si dépassement"
            style={{ flex: 1 }}
          />
        </View>

        <View style={{ height: 8 }} />
        <GPSStatusCard current={currentLocation} initial={initialLocation} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink[50] },
  container: { flex: 1 },
  statusRow: { marginBottom: 14 },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 8,
  },
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  smallRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 8,
  },
});
