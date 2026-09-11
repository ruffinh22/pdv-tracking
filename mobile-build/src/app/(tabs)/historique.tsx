import React, { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { colors, radius, shadow } from '@/theme/colors';
import AppHeader from '@/components/AppHeader';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { VenteLocale } from '@/types';

export default function HistoriqueScreen() {
  const { msisdn, history, refreshHistory } = useApp();

  useFocusEffect(
    useCallback(() => {
      refreshHistory();
    }, [refreshHistory])
  );

  const renderItem = ({ item }: { item: VenteLocale }) => (
    <View style={styles.item}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemProduct}>{item.produit}</Text>
        <Text style={styles.itemMeta}>
          {new Date(item.horodatage).toLocaleString('fr-FR')}
          {item.nom_vendeur ? ` · ${item.nom_vendeur}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {item.montant ? (
          <Text style={styles.itemAmount}>{Number(item.montant).toLocaleString('fr-FR')} FCFA</Text>
        ) : null}
        <Badge
          label={item.synchronise === 1 ? 'Synchronisé' : 'En attente'}
          tone={item.synchronise === 1 ? 'success' : 'warning'}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <AppHeader subtitle={msisdn} />
      <View style={styles.headerRow}>
        <Text style={styles.title}>Historique des ventes</Text>
        <Text style={styles.count}>{history.length} enregistrement(s)</Text>
      </View>
      <FlatList
        data={history}
        keyExtractor={(item, index) => {
          const base = item && item.id != null ? String(item.id) : String(item.horodatage ?? 'no-id');
          return `${base}-${index}`;
        }}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refreshHistory} tintColor={colors.primary[600]} />}
        ListEmptyComponent={
          <EmptyState title="Aucune vente enregistrée" subtitle="Vos ventes saisies apparaîtront ici." />
        }
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink[50] },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink[900] },
  count: { fontSize: 12, color: colors.ink[500] },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink[100],
    padding: 14,
    ...shadow.card,
  },
  itemProduct: { fontSize: 14, fontWeight: '700', color: colors.ink[800] },
  itemMeta: { fontSize: 12, color: colors.ink[500], marginTop: 3 },
  itemAmount: { fontSize: 13, fontWeight: '700', color: colors.success[700] },
});
