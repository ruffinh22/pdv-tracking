import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import { colors, radius } from '@/theme/colors';
import {
  confirmerBatterie, confirmerDemarrage, demanderDerogationBatterie, estAndroid,
  lireProtection, necessiteDemarrageAuto, ouvrirDemarrageAuto,
} from '@/lib/survieAndroid';

/**
 * Guide l'agent, une seule fois, pour que le système n'arrête pas le suivi
 * quand l'app est fermée. Disparaît quand les étapes sont confirmées.
 */
export default function ProtectionSuiviCard() {
  const [etat, setEtat] = useState<{ batterie: boolean; demarrage: boolean } | null>(null);
  const recharger = useCallback(() => { lireProtection().then(setEtat).catch(() => {}); }, []);
  useEffect(recharger, [recharger]);

  if (!estAndroid || !etat || (etat.batterie && etat.demarrage)) return null;

  const etape = (ok: boolean, titre: string, aide: string, ouvrir: () => Promise<void>, valider: () => Promise<void>) => (
    <View style={styles.etape}>
      <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={ok ? colors.primary[600] : colors.warning[500]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.titre}>{titre}</Text>
        {!ok && (
          <>
            <Text style={styles.aide}>{aide}</Text>
            <View style={styles.boutons}>
              <Pressable style={styles.bouton} onPress={() => ouvrir().catch(() => {})}>
                <Text style={styles.boutonTxt}>Ouvrir le réglage</Text>
              </Pressable>
              <Pressable style={styles.boutonSec} onPress={() => valider().then(recharger)}>
                <Text style={styles.boutonSecTxt}>C'est fait</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );

  return (
    <Card style={styles.card}>
      <Text style={styles.entete}>Protéger le suivi</Text>
      <Text style={styles.aide}>Sans ces réglages, le téléphone peut arrêter le suivi quand l'application est fermée.</Text>
      {etape(etat.batterie, 'Ne pas optimiser la batterie', 'Choisissez « Autoriser » (ou « Sans restriction »).', demanderDerogationBatterie, confirmerBatterie)}
      {necessiteDemarrageAuto() &&
        etape(etat.demarrage, 'Autoriser le démarrage automatique', 'Activez Tracking PDV dans la liste, pour qu\'il redémarre avec le téléphone.', ouvrirDemarrageAuto, confirmerDemarrage)}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 10, borderRadius: radius.lg, gap: 10 },
  entete: { fontSize: 15, fontWeight: '700', color: colors.primary[700] },
  etape: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  titre: { fontSize: 14, fontWeight: '600' },
  aide: { fontSize: 12.5, opacity: 0.75, marginTop: 2 },
  boutons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  bouton: { backgroundColor: colors.primary[600], paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  boutonTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  boutonSec: { borderWidth: 1, borderColor: colors.primary[600], paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  boutonSecTxt: { color: colors.primary[700], fontWeight: '600', fontSize: 13 },
});
