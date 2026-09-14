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
import { useApp } from '@/context/AppContext';
import { colors, radius } from '@/theme/colors';
import Button from '@/components/ui/Button';
import GPSStatusCard from '@/components/GPSStatusCard';
import { CONFIG } from '@/config';
import { getOrCreateTerminalId } from '@/lib/terminalId';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { register, refreshLocation, currentLocation } = useApp();
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshLocation();
    // L'ID terminal est généré (ou relu s'il existe déjà) dès l'arrivée sur
    // l'écran, pour l'afficher à l'utilisateur avant même qu'il n'appuie sur
    // "Se connecter" — il n'y a plus rien à saisir.
    getOrCreateTerminalId().then(setTerminalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await register();
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
          <GPSStatusCard current={currentLocation} initial={null} showRefreshButton={false} />

          <View style={{ height: 16 }} />

          <Animated.View entering={FadeInUp.delay(140).duration(420).springify().damping(18)} style={styles.formCard}>
            <Text style={styles.formTitle}>Connexion du point de vente</Text>

            <View style={styles.terminalBox}>
              <Text style={styles.terminalLabel}>ID terminal</Text>
              <Text style={styles.terminalValue} numberOfLines={1} ellipsizeMode="middle">
                {terminalId || 'Génération en cours…'}
              </Text>
              <Text style={styles.terminalHelper}>
                Identifiant unique de cet appareil, généré automatiquement. Il identifie votre PDV
                sur la plateforme — vous n'avez rien à saisir.
              </Text>
            </View>

            <Text style={styles.consentHelper}>
              Votre position GPS est utilisée pour créer le PDV, détecter les sorties de zone (rayon
              de 500 m) et horodater vos ventes.
            </Text>

            <View style={{ height: 8 }} />

            <Button
              title="Se connecter"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!terminalId}
            />
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
  terminalBox: {
    backgroundColor: colors.ink[50],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.ink[100],
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  terminalLabel: { fontSize: 12, fontWeight: '700', color: colors.ink[500], marginBottom: 4 },
  terminalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
    fontVariant: ['tabular-nums'],
  },
  terminalHelper: { fontSize: 11.5, color: colors.ink[400], marginTop: 6, lineHeight: 16 },
});