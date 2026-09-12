import React, { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
        <Animated.View entering={FadeInDown.duration(380)} style={styles.statusRow}>
          <Badge
            label={isTracking ? 'Suivi GPS actif' : 'Suivi GPS inactif'}
            tone={isTracking ? 'success' : 'warning'}
            pulse={isTracking}
          />
        </Animated.View>

        <View style={styles.featuredRow}>
          <StatCard
            label="Ventes du jour"
            value={ventesAujourdhui}
            tone="primary"
            icon={<Ionicons name="cart" size={16} color={colors.primary[600]} />}
            style={{ marginRight: 8 }}
            delay={40}
          />
          <StatCard
            label="En attente de sync"
            value={pendingVentes.length}
            tone="warning"
            icon={<Ionicons name="cloud-upload" size={16} color={colors.warning[600]} />}
            style={{ marginLeft: 8 }}
            delay={90}
          />
        </View>

        <View style={{ height: 8 }} />

        <View style={styles.smallRow}>
          <StatCard
            label="Total enregistré"
            value={history.length}
            tone="success"
            icon={<Ionicons name="checkmark-done" size={14} color={colors.success[600]} />}
            style={{ marginRight: 8 }}
            delay={140}
          />
          <StatCard
            label="Rayon autorisé"
            value="500 m"
            tone="danger"
            icon={<Ionicons name="locate" size={14} color={colors.danger[600]} />}
            hint="Alerte si dépassement"
            style={{}}
            delay={190}
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
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  smallRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
});
