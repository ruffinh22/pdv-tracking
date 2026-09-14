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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/context/AppContext';
import { colors, radius } from '@/theme/colors';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import GPSStatusCard from '@/components/GPSStatusCard';
import { CONFIG } from '@/config';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
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
        <Animated.View entering={FadeInDown.duration(480).springify().damping(18)}>
          <LinearGradient
            colors={[colors.primary[700], colors.primary[500]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 12 }]}
          >
            <View style={styles.flagChip}>
              <View style={[styles.flagDot, { backgroundColor: colors.flag.orange }]} />
              <View style={[styles.flagDot, { backgroundColor: colors.flag.white }]} />
              <View style={[styles.flagDot, { backgroundColor: colors.flag.green }]} />
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>PDV · Terrain</Text>
            </View>
            <Text style={styles.heroTitle}>Tracking PDV</Text>
            <Text style={styles.heroSubtitle}>
              Géolocalisez votre point de vente et démarrez le suivi de couverture terrain.
            </Text>
          </LinearGradient>
        </Animated.View>

        <View style={styles.content}>
          <GPSStatusCard current={currentLocation} initial={null} />

          <View style={{ height: 16 }} />

          <Animated.View entering={FadeInUp.delay(140).duration(420).springify().damping(18)} style={styles.formCard}>
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
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setConsent((v) => !v);
              }}
            />
            <Text style={styles.consentHelper}>
              Votre position est utilisée pour créer le PDV, détecter les sorties de zone (rayon
              de 500 m) et horodater vos ventes. Vous pouvez retirer ce consentement en désinstallant
              l'application.
            </Text>

            <View style={{ height: 8 }} />

            <Button title="Créer mon compte" onPress={handleSubmit} loading={submitting} />
            <Text style={styles.debugUrl}>Serveur : {CONFIG.API_BASE_URL}</Text>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  debugUrl: {
    textAlign: 'center',
    fontSize: 10.5,
    color: colors.ink[400],
    marginTop: 10,
  },
  container: { flex: 1, backgroundColor: colors.ink[50] },
  hero: {
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  flagChip: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  },
  flagDot: { width: 16, height: 4, borderRadius: 2 },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 18 },
  content: { paddingHorizontal: 16, paddingTop: 10, marginTop: -8, paddingBottom: 24 },
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
