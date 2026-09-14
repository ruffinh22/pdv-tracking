import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, Layout, ZoomIn, ZoomOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/context/AppContext';
import { colors, radius } from '@/theme/colors';
import AppHeader from '@/components/AppHeader';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import GPSStatusCard from '@/components/GPSStatusCard';
import ProductPickerModal from '@/components/ProductPickerModal';
import { syncService } from '@/services/syncService';
import { Produit } from '@/types';
import { formatTerminalIdShort } from '@/lib/terminalId';

// Conditional import for expo-location (native only)
let Location: any = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    console.warn('[ventes] Native modules not available:', e);
  }
}

export default function VentesScreen() {
  const { terminalId, pdvId, produits, loadProducts, initialLocation, refreshHistory, refreshLocation } = useApp();

  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy?: number | null } | null>(
    null
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selected, setSelected] = useState<Produit[]>([]);
  const [nomConcessionnaire, setNomConcessionnaire] = useState('');
  const [nomVendeur, setNomVendeur] = useState('');
  const [contactVendeur, setContactVendeur] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProducts();
    getLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getLocation = async () => {
    try {
      // Prefer app-level refreshLocation which handles web & native uniformly
      const point = await refreshLocation();
      if (point) {
        setLocation({ latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy });
      } else {
        setLocation(null);
      }
    } catch (error) {
      console.error('[ventes] Erreur GPS:', error);
      setLocation(null);
    }
  };

  const toggleProduct = (produit: Produit) => {
    setSelected((prev) =>
      prev.some((p) => p.id === produit.id) ? prev.filter((p) => p.id !== produit.id) : [...prev, produit]
    );
  };

  const total = selected.reduce((sum, p) => sum + Number(p.prix_unitaire || 0), 0);

  const resetForm = () => {
    setSelected([]);
    setNomConcessionnaire('');
    setNomVendeur('');
    setContactVendeur('');
  };

  const handleSubmit = async () => {
    if (selected.length === 0) {
      Alert.alert('Produit requis', 'Sélectionnez au moins un produit vendu.');
      return;
    }
    if (!nomVendeur.trim()) {
      Alert.alert('Champ requis', 'Le nom du vendeur est requis.');
      return;
    }

    setSubmitting(true);
    if (!pdvId) {
      Alert.alert('Compte requis', "Vous devez d'abord vous enregistrer / connecter avant d'enregistrer des ventes.");
      setSubmitting(false);
      return;
    }

    let gps = location;
    if (Platform.OS !== 'web') {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        gps = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy };
        setLocation(gps);
      } catch {
        // on garde la dernière position connue si l'acquisition échoue
      }
    }

    if (!gps) {
      Alert.alert('Position GPS requise', "Impossible d'obtenir votre position. Réessayez.");
      setSubmitting(false);
      return;
    }

    const horodatage = new Date().toISOString();

    // Chaque produit n'est écrit qu'en local ici (SQLite, quasi instantané) — l'envoi
    // au serveur part déjà en arrière-plan depuis saveVenteLocally. On n'attend plus
    // aucun aller-retour réseau avant de rendre la main à l'utilisateur : c'est ce qui
    // rendait la saisie d'une commande à plusieurs produits très lente auparavant.
    const results = await Promise.all(
      selected.map((produit) =>
        syncService.saveVenteLocally({
          produit: produit.nom_produit,
          nom_concessionnaire: nomConcessionnaire,
          nom_vendeur: nomVendeur,
          contact_vendeur: contactVendeur,
          montant: Number(produit.prix_unitaire) || 0,
          latitude: gps.latitude,
          longitude: gps.longitude,
          horodatage,
        })
      )
    );
    const successCount = results.filter(Boolean).length;

    await refreshHistory();
    setSubmitting(false);

    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Vente enregistrée', `${successCount} ligne(s) de vente enregistrée(s) avec succès.`);
    resetForm();

    // Synchronisation de rattrapage en arrière-plan (ventes/positions en attente),
    // sans bloquer l'écran : l'utilisateur peut déjà enchaîner sur autre chose.
    if (typeof (syncService as any).autoSync === 'function') {
      (syncService as any).autoSync().catch((e: unknown) => {
        console.warn('[ventes] autoSync failed:', e);
      });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.screen}>
        <AppHeader title="Nouvelle vente" icon="cart" subtitle={formatTerminalIdShort(terminalId)} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={styles.pageTitle}>Saisie des ventes</Text>
          <Text style={styles.pageSubtitle}>Enregistrez vos ventes sur le terrain, même hors connexion.</Text>

          <View style={{ height: 14 }} />
          <GPSStatusCard current={location} initial={initialLocation} />
          <View style={{ height: 14 }} />

          <Animated.View entering={FadeInDown.delay(80).duration(380)}>
            <Card>
              <Text style={styles.label}>Produits vendus</Text>
              <TouchableOpacity style={styles.picker} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
                <Text style={selected.length > 0 ? styles.pickerTextActive : styles.pickerText}>
                  {selected.length > 0 ? `${selected.length} produit(s) sélectionné(s)` : 'Choisir des produits…'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.ink[400]} />
              </TouchableOpacity>

              {selected.length > 0 && (
                <View style={styles.chipsWrap}>
                  {selected.map((p) => (
                    <Animated.View
                      key={`${p.id}-${p.nom_produit}`}
                      entering={ZoomIn.duration(180)}
                      exiting={ZoomOut.duration(140)}
                      layout={Layout.springify().damping(18)}
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>{p.nom_produit}</Text>
                      <TouchableOpacity onPress={() => toggleProduct(p)} hitSlop={6}>
                        <Ionicons name="close" size={14} color={colors.primary[800]} />
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              )}

              {total > 0 && (
                <Animated.Text entering={FadeIn.duration(220)} style={styles.total}>
                  Total estimé : {total.toLocaleString('fr-FR')} FCFA
                </Animated.Text>
              )}

            <View style={{ height: 6 }} />
            <Input
              label="Nom du concessionnaire"
              placeholder="Ex : Distributeur Centre-Ville"
              value={nomConcessionnaire}
              onChangeText={setNomConcessionnaire}
            />
            <Input
              label="Nom du vendeur"
              placeholder="Votre nom"
              value={nomVendeur}
              onChangeText={setNomVendeur}
            />
            <Input
              label="Contact du vendeur"
              placeholder="Numéro de téléphone"
              keyboardType="phone-pad"
              value={contactVendeur}
              onChangeText={setContactVendeur}
            />

            <Text style={styles.meta}>
              📅 {new Date().toLocaleDateString('fr-FR')} · ⏰ {new Date().toLocaleTimeString('fr-FR')}
            </Text>

              <View style={{ height: 4 }} />
              <Button title="Enregistrer la vente" variant="success" onPress={handleSubmit} loading={submitting} />
            </Card>
          </Animated.View>
        </ScrollView>

        <ProductPickerModal
          visible={pickerVisible}
          produits={produits}
          selectedIds={selected.map((p) => p.id)}
          onToggle={toggleProduct}
          onClose={() => setPickerVisible(false)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink[50] },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.ink[900] },
  pageSubtitle: { fontSize: 13, color: colors.ink[500], marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink[700], marginBottom: 6 },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  pickerText: { fontSize: 14, color: colors.ink[400] },
  pickerTextActive: { fontSize: 14, color: colors.ink[800], fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary[100],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.primary[800] },
  total: { fontSize: 14, fontWeight: '800', color: colors.success[700], textAlign: 'right', marginBottom: 12 },
  meta: { fontSize: 12, color: colors.ink[400], marginTop: 4, marginBottom: 16 },
});