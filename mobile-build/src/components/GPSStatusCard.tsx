import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import { useApp } from '@/context/AppContext';
import { colors, radius } from '@/theme/colors';
import { CONFIG } from '@/config';
import { distanceMeters, formatDistance } from '@/lib/geo';
import { ouvrirDansMaps, ouvrirReglages } from '@/lib/location';
import { GPSPoint } from '@/types';

interface Props {
  current: GPSPoint | null;
  initial: GPSPoint | null;
  showRefreshButton?: boolean;
}

/** Ligne libellé / valeur des coordonnées. */
function Ligne({
  label,
  valeur,
  couleur,
}: {
  label: string;
  valeur: string;
  couleur?: string;
}) {
  return (
    <View style={styles.coordRow}>
      <Text style={styles.coordLabel}>{label}</Text>
      <Text style={[styles.coordValue, couleur ? { color: couleur } : null]}>{valeur}</Text>
    </View>
  );
}

export default function GPSStatusCard({ current, initial, showRefreshButton = true }: Props) {
  const { refreshLocation, etatGPS } = useApp();

  const distance =
    current && initial
      ? distanceMeters(initial.latitude, initial.longitude, current.latitude, current.longitude)
      : null;

  const horsZone = distance !== null && distance > CONFIG.GEOFENCE_DEFAULT_RADIUS_METERS;

  const secousse = useSharedValue(0);
  const precedemmentHorsZone = React.useRef(horsZone);

  useEffect(() => {
    if (horsZone && !precedemmentHorsZone.current) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      secousse.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 90 }),
        withTiming(-4, { duration: 90 }),
        withTiming(0, { duration: 90 })
      );
    }
    precedemmentHorsZone.current = horsZone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horsZone]);

  const styleSecousse = useAnimatedStyle(() => ({
    transform: [{ translateX: secousse.value }],
  }));

  const enAcquisition = etatGPS.statut === 'acquisition';
  const enEchec = etatGPS.statut === 'echec';
  const positionEnCache = etatGPS.statut === 'ok' && etatGPS.source === 'cache';

  const handleOuvrirMaps = async () => {
    if (!current) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    await ouvrirDansMaps(current, 'Position du point de vente');
  };

  return (
    <Animated.View entering={FadeInUp.duration(420).springify().damping(16)} style={styleSecousse}>
      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Position GPS</Text>
          {distance !== null ? (
            <Badge
              label={horsZone ? `Hors zone (> ${CONFIG.GEOFENCE_DEFAULT_RADIUS_METERS} m)` : 'Dans la zone'}
              tone={horsZone ? 'danger' : 'success'}
              pulse={!horsZone}
            />
          ) : null}
        </View>

        {/* Les coordonnées connues restent affichées même pendant une nouvelle
            acquisition : rien ne disparaît sous les yeux de l'utilisateur. */}
        {current ? (
          <>
            <Ligne label="Latitude" valeur={current.latitude.toFixed(6)} />
            <Ligne label="Longitude" valeur={current.longitude.toFixed(6)} />
            {typeof current.accuracy === 'number' ? (
              <Ligne label="Précision" valeur={`±${Math.round(current.accuracy)} m`} />
            ) : null}
            {distance !== null ? (
              <Ligne
                label="Distance / point de tagging"
                valeur={formatDistance(distance)}
                couleur={horsZone ? colors.danger[600] : colors.success[700]}
              />
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionSecondaire}
                onPress={handleOuvrirMaps}
                activeOpacity={0.75}
              >
                <Ionicons name="map-outline" size={15} color={colors.primary[700]} />
                <Text style={styles.actionSecondaireTexte}>Ouvrir dans Maps</Text>
              </TouchableOpacity>

              {showRefreshButton ? (
                <TouchableOpacity
                  style={styles.actionSecondaire}
                  onPress={refreshLocation}
                  disabled={enAcquisition}
                  activeOpacity={0.75}
                >
                  {enAcquisition ? (
                    <ActivityIndicator size="small" color={colors.primary[600]} />
                  ) : (
                    <Ionicons name="refresh" size={15} color={colors.primary[700]} />
                  )}
                  <Text style={styles.actionSecondaireTexte}>
                    {enAcquisition ? 'Acquisition…' : 'Actualiser'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {positionEnCache ? (
              <Text style={styles.note}>
                Position issue du cache de l'appareil. Elle se précisera dès que le GPS aura capté un
                signal.
              </Text>
            ) : null}
          </>
        ) : enAcquisition ? (
          <View style={styles.etatRow}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
            <Text style={styles.etatTexte}>Acquisition de la position en cours…</Text>
          </View>
        ) : enEchec ? (
          <View>
            <View style={styles.etatRow}>
              <Ionicons name="warning-outline" size={16} color={colors.danger[600]} />
              <Text style={[styles.etatTexte, { color: colors.danger[600], flex: 1 }]}>
                {etatGPS.message}
              </Text>
            </View>
            {showRefreshButton ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Button title="Réessayer" onPress={refreshLocation} variant="secondary" />
                {etatGPS.raison === 'permission_refusee' || etatGPS.raison === 'service_desactive' ? (
                  <Button title="Ouvrir les réglages" onPress={ouvrirReglages} variant="ghost" />
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.etatRow}>
            <Ionicons name="location-outline" size={16} color={colors.ink[400]} />
            <Text style={styles.etatTexte}>Position non encore relevée.</Text>
            {showRefreshButton ? (
              <TouchableOpacity onPress={refreshLocation} hitSlop={8}>
                <Text style={styles.lien}>Relever</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 13, fontWeight: '700', color: colors.ink[800] },
  coordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[50],
  },
  coordLabel: { fontSize: 11.5, color: colors.ink[500] },
  coordValue: { fontSize: 11.5, fontWeight: '700', color: colors.ink[800] },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionSecondaire: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
    backgroundColor: colors.primary[50],
  },
  actionSecondaireTexte: { fontSize: 12, fontWeight: '700', color: colors.primary[700] },
  etatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  etatTexte: { fontSize: 12, color: colors.ink[500], lineHeight: 17 },
  lien: { fontSize: 12, fontWeight: '700', color: colors.primary[700] },
  note: { fontSize: 11, color: colors.ink[400], marginTop: 10, lineHeight: 15 },
});
