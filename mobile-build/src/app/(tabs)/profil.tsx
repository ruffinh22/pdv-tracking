import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '@/context/AppContext';
import { colors, radius } from '@/theme/colors';
import AppHeader from '@/components/AppHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { CONFIG } from '@/config';
import { formatTerminalIdShort } from '@/lib/terminalId';

export default function ProfilScreen() {
  const {
    terminalId,
    pdvId,
    agent,
    matricule,
    isTracking,
    permissionArrierePlan,
    positionsEnAttente,
    derniereSynchro,
    syncNow,
    syncStatus,
    logout,
  } = useApp();

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Cela supprimera les identifiants et les positions stockés sur cet appareil. Les données déjà remontées au serveur sont conservées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.warn('[profil] Déconnexion en échec:', error);
              Alert.alert('Erreur', 'La déconnexion a rencontré une erreur.');
            } finally {
              // Une seule redirection, dans tous les cas : l'ancienne version
              // enchaînait une alerte de confirmation avant de rediriger, ce
              // qui laissait un écran vide derrière la boîte de dialogue.
              router.replace('/onboarding');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Mon profil" icon="person" subtitle={formatTerminalIdShort(terminalId)} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Animated.View entering={FadeInDown.duration(400).springify().damping(18)}>
          <Card style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons name="storefront" size={26} color={colors.primary[600]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pdvId}>PDV #{pdvId ?? '—'}</Text>
              <Text style={styles.sousTitre} numberOfLines={1} ellipsizeMode="middle">
                ID terminal · {terminalId || '—'}
              </Text>
            </View>
            <Badge
              label={isTracking ? 'Suivi actif' : 'Suivi inactif'}
              tone={isTracking ? 'success' : 'warning'}
              pulse={isTracking}
            />
          </Card>
        </Animated.View>

        <View style={{ height: 14 }} />

        <Animated.View entering={FadeInDown.delay(60).duration(400).springify().damping(18)}>
          <Card>
            <Text style={styles.sectionTitle}>Agent associé</Text>
            <Row label="Matricule" value={matricule || '—'} />
            <Row
              label="Nom"
              value={agent ? `${agent.prenom} ${agent.nom}` : 'Non renseigné'}
            />
          </Card>
        </Animated.View>

        <View style={{ height: 14 }} />

        <Animated.View entering={FadeInDown.delay(120).duration(400).springify().damping(18)}>
          <Card>
            <Text style={styles.sectionTitle}>Synchronisation</Text>
            <Row label="Positions en attente" value={String(positionsEnAttente)} />
            <Row
              label="Dernière synchronisation"
              value={
                derniereSynchro
                  ? new Date(derniereSynchro).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Jamais'
              }
            />
            <Row label="Serveur" value={CONFIG.API_BASE_URL.replace('/api', '')} />
            <View style={{ height: 12 }} />
            <Button
              title="Synchroniser maintenant"
              onPress={syncNow}
              loading={syncStatus === 'syncing'}
              variant="secondary"
            />
          </Card>
        </Animated.View>

        <View style={{ height: 14 }} />

        <Animated.View entering={FadeInDown.delay(180).duration(400).springify().damping(18)}>
          <Card>
            <Text style={styles.sectionTitle}>Confidentialité & géolocalisation</Text>
            <Text style={styles.privacyText}>
              Votre position GPS est collectée pour assurer la couverture terrain et détecter
              automatiquement toute sortie de la zone autorisée (rayon de{' '}
              {CONFIG.GEOFENCE_DEFAULT_RADIUS_METERS} m autour du point de tagging). Ces données sont
              transmises au serveur et consultables par votre superviseur. Aucune donnée
              commerciale — produit, montant, transaction — n'est enregistrée par cette application.
            </Text>
            {!permissionArrierePlan ? (
              <Text style={styles.privacyAvertissement}>
                La localisation en arrière-plan n'est pas autorisée : votre position n'est relevée
                que lorsque l'application est ouverte.
              </Text>
            ) : null}
          </Card>
        </Animated.View>

        <View style={{ height: 20 }} />
        {/* Le bouton « Purger données locales » a été retiré : il faisait
            doublon avec la déconnexion (qui vide déjà la base) et redirigeait
            vers une route inexistante, ce qui cassait la navigation. */}
        <Button title="Se déconnecter" variant="danger" onPress={handleLogout} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink[50] },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdvId: { fontSize: 15, fontWeight: '800', color: colors.ink[900] },
  sousTitre: { fontSize: 12, color: colors.ink[500], marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink[800], marginBottom: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[50],
  },
  rowLabel: { fontSize: 13, color: colors.ink[500] },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.ink[800], maxWidth: '60%' },
  privacyText: { fontSize: 12.5, color: colors.ink[500], lineHeight: 19 },
  privacyAvertissement: {
    fontSize: 12,
    color: colors.warning[700],
    lineHeight: 17,
    marginTop: 10,
    fontWeight: '600',
  },
});
