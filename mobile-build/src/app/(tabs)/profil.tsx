import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
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
            await logout();
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader subtitle={msisdn} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="storefront" size={26} color={colors.primary[600]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pdvId}>PDV #{pdvId ?? '—'}</Text>
            <Text style={styles.msisdn}>{msisdn}</Text>
          </View>
          <Badge label={isTracking ? 'Suivi actif' : 'Suivi inactif'} tone={isTracking ? 'success' : 'warning'} />
        </Card>

        <View style={{ height: 14 }} />

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

        <View style={{ height: 14 }} />

        <Card>
          <Text style={styles.sectionTitle}>Confidentialité & géolocalisation</Text>
          <Text style={styles.privacyText}>
            Votre position GPS est collectée en continu pour assurer la couverture terrain et
            détecter automatiquement toute sortie de la zone autorisée (rayon de {CONFIG.GEOFENCE_DEFAULT_RADIUS_METERS} m
            autour du point de tagging). Ces données sont transmises de façon chiffrée au serveur
            et consultables par votre superviseur sur le dashboard.
          </Text>
        </Card>

        <View style={{ height: 20 }} />
        <Button title="Se déconnecter" variant="danger" onPress={handleLogout} />
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
