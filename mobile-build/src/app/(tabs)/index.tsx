import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { colors, radius } from '@/theme/colors';
import StatCard from '@/components/ui/StatCard';
import GPSStatusCard from '@/components/GPSStatusCard';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import AppHeader from '@/components/AppHeader';
import { CONFIG } from '@/config';
import { formatTerminalIdShort } from '@/lib/terminalId';

/**
 * Écran de suivi. Il ne présente plus de compteurs de ventes ni de montants :
 * l'app tague un point de vente et remonte sa position, c'est tout ce qu'elle
 * mesure. Les indicateurs affichés sont donc ceux du suivi lui-même.
 */
export default function SuiviScreen() {
  const {
    terminalId,
    pdvId,
    isTracking,
    permissionArrierePlan,
    currentLocation,
    initialLocation,
    etatGPS,
    positionsEnAttente,
    refreshLocation,
    refreshQueue,
  } = useApp();

  const [rafraichissement, setRafraichissement] = useState(false);

  // À chaque retour sur l'écran : on relit la file locale (instantané) et on
  // relance une acquisition. `refreshLocation` se termine toujours, donc cet
  // effet ne peut plus laisser l'écran bloqué sur un indicateur de chargement.
  useFocusEffect(
    useCallback(() => {
      refreshQueue();
      refreshLocation();
    }, [refreshQueue, refreshLocation])
  );

  const onRefresh = useCallback(async () => {
    setRafraichissement(true);
    try {
      await Promise.all([refreshLocation(), refreshQueue()]);
    } finally {
      setRafraichissement(false);
    }
  }, [refreshLocation, refreshQueue]);

  const libelleSuivi = isTracking
    ? 'Suivi GPS actif'
    : permissionArrierePlan
      ? 'Suivi GPS en pause'
      : "Suivi GPS limité à l'application ouverte";

  return (
    <View style={styles.screen}>
      <AppHeader title="Suivi" icon="navigate" subtitle={formatTerminalIdShort(terminalId)} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(380)} style={styles.statusRow}>
          <Badge
            label={libelleSuivi}
            tone={isTracking ? 'success' : 'warning'}
            pulse={isTracking}
          />
        </Animated.View>

        <View style={styles.row}>
          <StatCard
            label="Positions en attente"
            value={positionsEnAttente}
            tone={positionsEnAttente > 0 ? 'warning' : 'success'}
            icon={
              <Ionicons
                name="cloud-upload"
                size={15}
                color={positionsEnAttente > 0 ? colors.warning[600] : colors.success[600]}
              />
            }
            hint={positionsEnAttente > 0 ? 'Envoi au prochain réseau' : 'Tout est synchronisé'}
            style={{ marginRight: 8 }}
            delay={40}
          />
          <StatCard
            label="Rayon autorisé"
            value={`${CONFIG.GEOFENCE_DEFAULT_RADIUS_METERS} m`}
            tone="primary"
            icon={<Ionicons name="locate" size={15} color={colors.primary[600]} />}
            hint="Alerte si dépassement"
            delay={90}
          />
        </View>

        <View style={{ height: 10 }} />
        <GPSStatusCard current={currentLocation} initial={initialLocation} />

        {/* Avertissement explicite quand le suivi ne peut pas tourner en
            arrière-plan. Avant, l'app sortait silencieusement de la routine de
            démarrage et l'agent croyait être suivi alors qu'il ne l'était pas. */}
        {!isTracking && !permissionArrierePlan ? (
          <>
            <View style={{ height: 10 }} />
            <Animated.View entering={FadeInDown.delay(140).duration(380)}>
              <Card style={styles.avertissement}>
                <View style={styles.avertissementEntete}>
                  <Ionicons name="alert-circle" size={17} color={colors.warning[600]} />
                  <Text style={styles.avertissementTitre}>Suivi en arrière-plan désactivé</Text>
                </View>
                <Text style={styles.avertissementTexte}>
                  Votre position n'est remontée que lorsque l'application est ouverte. Autorisez la
                  localisation « Toujours » dans les réglages du téléphone pour que la couverture
                  terrain soit complète.
                </Text>
              </Card>
            </Animated.View>
          </>
        ) : null}

        <View style={{ height: 10 }} />

        <Animated.View entering={FadeInDown.delay(180).duration(380)}>
          <Card>
            <Text style={styles.sectionTitre}>Point de vente</Text>
            <Ligne label="Identifiant" valeur={pdvId ? `PDV #${pdvId}` : 'Non associé'} />
            <Ligne label="Terminal" valeur={terminalId || '—'} />
            <Ligne
              label="Point de tagging"
              valeur={
                initialLocation
                  ? `${initialLocation.latitude.toFixed(5)}, ${initialLocation.longitude.toFixed(5)}`
                  : 'Non enregistré'
              }
            />
            <Ligne
              label="État du signal"
              valeur={
                etatGPS.statut === 'ok'
                  ? etatGPS.source === 'cache'
                    ? 'Position en cache'
                    : 'Signal capté'
                  : etatGPS.statut === 'acquisition'
                    ? 'Acquisition…'
                    : etatGPS.statut === 'echec'
                      ? 'Indisponible'
                      : 'Inconnu'
              }
            />
          </Card>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.ligneLabel}>{label}</Text>
      <Text style={styles.ligneValeur} numberOfLines={1} ellipsizeMode="middle">
        {valeur}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink[50] },
  container: { flex: 1 },
  statusRow: { marginBottom: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  sectionTitre: { fontSize: 13, fontWeight: '800', color: colors.ink[800], marginBottom: 8 },
  ligne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[50],
  },
  ligneLabel: { fontSize: 12, color: colors.ink[500] },
  ligneValeur: { fontSize: 12, fontWeight: '700', color: colors.ink[800], maxWidth: '60%' },
  avertissement: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning[100],
    backgroundColor: colors.warning[50],
  },
  avertissementEntete: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  avertissementTitre: { fontSize: 13, fontWeight: '800', color: colors.warning[700] },
  avertissementTexte: { fontSize: 12, color: colors.ink[600], lineHeight: 17 },
});
