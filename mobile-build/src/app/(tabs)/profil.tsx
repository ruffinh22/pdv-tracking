import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '@/context/AppContext';
import { clearAllData } from '@/lib/database';
import { colors, radius } from '@/theme/colors';
import AppHeader from '@/components/AppHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { CONFIG } from '@/config';

export default function ProfilScreen() {
  const { msisdn, pdvId, isTracking, pendingVentes, history, syncNow, syncStatus, logout } = useApp();

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Cela supprimera vos identifiants locaux. Vos ventes déjà synchronisées restent en base.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              Alert.alert('Déconnecté', 'Vos identifiants locaux ont été supprimés.');
            } catch (error) {
              console.warn('[profil] logout failed:', error);
              Alert.alert('Erreur', 'La déconnexion a rencontré une erreur.');
            } finally {
              router.replace('/onboarding');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Mon profil" icon="person" subtitle={msisdn} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Animated.View entering={FadeInDown.delay(0).duration(400).springify().damping(18)}>
          <Card style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons name="storefront" size={26} color={colors.primary[600]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pdvId}>PDV #{pdvId ?? '—'}</Text>
              <Text style={styles.msisdn}>{msisdn}</Text>
            </View>
            <Badge
              label={isTracking ? 'Suivi actif' : 'Suivi inactif'}
              tone={isTracking ? 'success' : 'warning'}
              pulse={isTracking}
            />
          </Card>
        </Animated.View>

        <View style={{ height: 14 }} />

        <Animated.View entering={FadeInDown.delay(80).duration(400).springify().damping(18)}>
          <Card>
            <Text style={styles.sectionTitle}>Synchronisation</Text>
            <Row label="Ventes en attente" value={String(pendingVentes.length)} />
            <Row label="Total local" value={String(history.length)} />
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

        <Animated.View entering={FadeInDown.delay(160).duration(400).springify().damping(18)}>
          <Card>
            <Text style={styles.sectionTitle}>Confidentialité & géolocalisation</Text>
            <Text style={styles.privacyText}>
              Votre position GPS est collectée en continu pour assurer la couverture terrain et
              détecter automatiquement toute sortie de la zone autorisée (rayon de {CONFIG.GEOFENCE_DEFAULT_RADIUS_METERS} m
              autour du point de tagging). Ces données sont transmises de façon chiffrée au serveur
              et consultables par votre superviseur sur le dashboard.
            </Text>
          </Card>
        </Animated.View>

        <View style={{ height: 20 }} />
        <Button title="Se déconnecter" variant="danger" onPress={handleLogout} />
        <View style={{ height: 8 }} />
        <Button
          title="Purger données locales"
          variant="ghost"
          onPress={async () => {
            Alert.alert('Purger données', 'Voulez-vous supprimer les ventes et positions locales ?', [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Supprimer',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await clearAllData();
                    Alert.alert('Terminé', 'Données locales supprimées.');
                    // refresh UI
                    router.replace('/profil');
                  } catch (e) {
                    console.warn('[profil] purge failed', e);
                    Alert.alert('Erreur', 'Impossible de purger les données locales.');
                  }
                },
              },
            ]);
          }}
        />
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
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
  msisdn: { fontSize: 12, color: colors.ink[500], marginTop: 2 },
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
});
