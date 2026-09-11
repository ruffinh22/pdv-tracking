import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { colors, radius } from '@/theme/colors';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import GPSStatusCard from '@/components/GPSStatusCard';

export default function OnboardingScreen() {
  const { register, refreshLocation, currentLocation } = useApp();
  const [msisdn, setMsisdn] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    const cleaned = msisdn.replace(/\s+/g, '');
    if (cleaned.length < 8) {
      Alert.alert('Numéro invalide', 'Veuillez saisir un numéro MSISDN valide.');
      return;
    }
    if (!consent) {
      Alert.alert(
        'Consentement requis',
        "Merci d'accepter la collecte de votre position GPS pour activer le suivi du point de vente."
      );
      return;
    }

    setSubmitting(true);
    const result = await register(cleaned);
    setSubmitting(false);

    if (result.ok) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Erreur', result.message || 'Une erreur est survenue.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
        <LinearGradient
          colors={[colors.primary[700], colors.primary[500]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>PDV · Terrain</Text>
          </View>
          <Text style={styles.heroTitle}>Tracking PDV</Text>
          <Text style={styles.heroSubtitle}>
            Géolocalisez votre point de vente et démarrez le suivi de couverture terrain.
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          <GPSStatusCard current={currentLocation} initial={null} />

          <View style={{ height: 16 }} />

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Créer / retrouver votre compte</Text>
            <Input
              label="Numéro MSISDN"
              placeholder="+229 90 00 00 00"
              keyboardType="phone-pad"
              maxLength={17}
              value={msisdn}
              onChangeText={setMsisdn}
              helper="Ce numéro identifie votre PDV de façon unique sur la plateforme."
            />

            <Button
              title={consent ? '✓ Consentement accordé' : "J'accepte la géolocalisation (RGPD)"}
              variant={consent ? 'success' : 'secondary'}
              onPress={() => setConsent((v) => !v)}
            />
            <Text style={styles.consentHelper}>
              Votre position est utilisée pour créer le PDV, détecter les sorties de zone (rayon
              de 500 m) et horodater vos ventes. Vous pouvez retirer ce consentement en désinstallant
              l'application.
            </Text>

            <View style={{ height: 8 }} />

            <Button title="Créer mon compte" onPress={handleSubmit} loading={submitting} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink[50] },
  hero: {
    paddingTop: 64,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 6 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  content: { padding: 20, marginTop: -24 },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.ink[100],
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: colors.ink[900], marginBottom: 14 },
  consentHelper: { fontSize: 11.5, color: colors.ink[400], marginTop: 8, lineHeight: 16 },
});
