import React, { useEffect, useRef, useState } from 'react';
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
import Input from '@/components/ui/Input';
import GPSStatusCard from '@/components/GPSStatusCard';
import { CONFIG } from '@/config';
import { api } from '@/lib/api';
import { getOrCreateTerminalId } from '@/lib/terminalId';

type EtatVerification =
  | { statut: 'vide' }
  | { statut: 'verification' }
  | { statut: 'trouve'; nom: string; prenom: string }
  | { statut: 'inconnu' };

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { register, refreshLocation, currentLocation } = useApp();
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [matricule, setMatricule] = useState('');
  const [verification, setVerification] = useState<EtatVerification>({ statut: 'vide' });
  const [submitting, setSubmitting] = useState(false);
  const verificationEnCours = useRef<string | null>(null);

  useEffect(() => {
    // L'acquisition GPS est lancée sans être attendue : elle se termine
    // toujours (succès ou échec typé) et la carte de position affiche son
    // propre état. L'écran reste utilisable pendant ce temps — l'agent peut
    // saisir son matricule sans attendre le signal.
    refreshLocation();
    // L'ID terminal est lu (ou créé au premier lancement) dès l'arrivée sur
    // l'écran, pour l'afficher avant même que l'agent n'appuie sur
    // "Se connecter" : il n'a rien à saisir de ce côté-là.
    getOrCreateTerminalId().then(setTerminalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vérification du matricule pendant la saisie, plutôt qu'au moment de la
  // soumission : l'agent voit son nom s'afficher (ou une faute de frappe
  // signalée) sans avoir à attendre le relevé GPS, qui est l'étape lente.
  useEffect(() => {
    const valeur = matricule.trim().toUpperCase();
    if (valeur.length < 3) {
      setVerification({ statut: 'vide' });
      return;
    }

    const minuteur = setTimeout(async () => {
      verificationEnCours.current = valeur;
      setVerification({ statut: 'verification' });
      try {
        const { data } = await api.get(`/pdv/mobile/matricule/${encodeURIComponent(valeur)}`, {
          timeout: 6000,
        });
        // Une réponse plus lente qu'une frappe suivante ne doit pas écraser
        // le résultat de la saisie la plus récente.
        if (verificationEnCours.current !== valeur) return;
        setVerification({ statut: 'trouve', nom: data.nom, prenom: data.prenom });
      } catch (error: any) {
        if (verificationEnCours.current !== valeur) return;
        // Un serveur injoignable n'est pas un matricule invalide : on n'affiche
        // "inconnu" que si le serveur a répondu explicitement 404.
        setVerification(error?.response?.status === 404 ? { statut: 'inconnu' } : { statut: 'vide' });
      }
    }, 450);

    return () => clearTimeout(minuteur);
  }, [matricule]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await register(matricule);
    setSubmitting(false);

    if (result.ok) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Connexion impossible', result.message || 'Une erreur est survenue.');
    }
  };

  const matriculeValide = matricule.trim().length >= 3;

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
              Géolocalisez le point de vente et démarrez le suivi de couverture terrain.
            </Text>
          </LinearGradient>
        </Animated.View>

        <View style={styles.content}>
          <GPSStatusCard current={currentLocation} initial={null} />

          <View style={{ height: 16 }} />

          <Animated.View
            entering={FadeInUp.delay(140).duration(420).springify().damping(18)}
            style={styles.formCard}
          >
            <Text style={styles.formTitle}>Connexion du point de vente</Text>

            <Input
              label="Numéro matricule de l'agent"
              value={matricule}
              onChangeText={(t) => setMatricule(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Ex: AG00412"
              returnKeyType="done"
              editable={!submitting}
            />

            {verification.statut === 'verification' ? (
              <Text style={styles.verifNeutre}>Vérification du matricule…</Text>
            ) : verification.statut === 'trouve' ? (
              <Text style={styles.verifOk}>
                Agent reconnu : {verification.prenom} {verification.nom}
              </Text>
            ) : verification.statut === 'inconnu' ? (
              <Text style={styles.verifErreur}>
                Matricule inconnu. Vérifiez votre numéro auprès de votre superviseur.
              </Text>
            ) : null}

            <View style={styles.terminalBox}>
              <Text style={styles.terminalLabel}>ID terminal</Text>
              <Text style={styles.terminalValue} numberOfLines={1} ellipsizeMode="middle">
                {terminalId || 'Génération en cours…'}
              </Text>
              <Text style={styles.terminalHelper}>
                Identifiant unique de cet appareil, récupéré automatiquement. Il identifie ce point
                de vente sur la plateforme — vous n'avez rien à saisir ici.
              </Text>
            </View>

            <Text style={styles.consentHelper}>
              À la connexion, la position GPS actuelle est enregistrée comme emplacement du point de
              vente. Le dossier est créé en brouillon : vous le compléterez ensuite depuis le
              back-office (nom, prénom, agence, superviseur…).
            </Text>

            <View style={{ height: 8 }} />

            <Button
              title="Se connecter"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!terminalId || !matriculeValide || verification.statut === 'inconnu'}
            />
            {!currentLocation ? (
              <Text style={styles.gpsHelper}>
                La position sera relevée au moment de la connexion. Assurez-vous que le GPS est
                activé et que vous êtes à l'air libre.
              </Text>
            ) : null}
            <Text style={styles.debugUrl}>Serveur : {CONFIG.API_BASE_URL}</Text>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  gpsHelper: {
    fontSize: 11.5,
    color: colors.ink[400],
    marginTop: 10,
    lineHeight: 16,
    textAlign: 'center',
  },
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
  verifNeutre: { fontSize: 12, color: colors.ink[400], marginTop: -8, marginBottom: 12 },
  verifOk: { fontSize: 12, color: colors.success[600], fontWeight: '700', marginTop: -8, marginBottom: 12 },
  verifErreur: { fontSize: 12, color: colors.danger[600], fontWeight: '600', marginTop: -8, marginBottom: 12 },
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
