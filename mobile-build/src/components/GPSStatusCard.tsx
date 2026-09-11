import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Button from './ui/Button';
import { useApp } from '@/context/AppContext';
import Card from './ui/Card';
import Badge from './ui/Badge';
import { colors } from '@/theme/colors';
import { CONFIG } from '@/config';
import { distanceMeters, formatDistance } from '@/lib/geo';
import { GPSPoint } from '@/types';

interface Props {
  current: GPSPoint | null;
  initial: GPSPoint | null;
}

export default function GPSStatusCard({ current, initial }: Props) {
  const { refreshLocation } = useApp();
  const distance =
    current && initial
      ? distanceMeters(initial.latitude, initial.longitude, current.latitude, current.longitude)
      : null;

  const outOfZone = distance !== null && distance > CONFIG.GEOFENCE_DEFAULT_RADIUS_METERS;

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Position GPS</Text>
        {distance !== null ? (
          <Badge
            label={outOfZone ? 'Hors zone (> 500 m)' : 'Dans la zone'}
            tone={outOfZone ? 'danger' : 'success'}
          />
        ) : null}
      </View>

      {current ? (
        <>
          <View style={styles.coordRow}>
            <Text style={styles.coordLabel}>Latitude</Text>
            <Text style={styles.coordValue}>{current.latitude.toFixed(6)}</Text>
          </View>
          <View style={styles.coordRow}>
            <Text style={styles.coordLabel}>Longitude</Text>
            <Text style={styles.coordValue}>{current.longitude.toFixed(6)}</Text>
          </View>
          {typeof current.accuracy === 'number' && (
            <View style={styles.coordRow}>
              <Text style={styles.coordLabel}>Précision</Text>
              <Text style={styles.coordValue}>±{Math.round(current.accuracy)} m</Text>
            </View>
          )}
          {distance !== null && (
            <View style={styles.coordRow}>
              <Text style={styles.coordLabel}>Distance / point de tagging</Text>
              <Text
                style={[
                  styles.coordValue,
                  outOfZone ? { color: colors.danger[600] } : { color: colors.success[700] },
                ]}
              >
                {formatDistance(distance)}
              </Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary[600]} />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.loadingText}>Position introuvable — activez la géolocalisation.</Text>
            <View style={{ height: 8 }} />
            <Button title="Réessayer" onPress={refreshLocation} variant="secondary" />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 13, fontWeight: '700', color: colors.ink[800] },
  coordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[50],
  },
  coordLabel: { fontSize: 11.5, color: colors.ink[500] },
  coordValue: { fontSize: 11.5, fontWeight: '700', color: colors.ink[800] },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  loadingText: { fontSize: 12, color: colors.ink[500] },
});
