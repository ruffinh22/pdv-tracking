import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList } from 'react-native';
import { colors, radius, shadow } from '@/theme/colors';
import { Produit } from '@/types';
import Button from './ui/Button';

interface Props {
  visible: boolean;
  produits: Produit[];
  selectedIds: number[];
  onToggle: (produit: Produit) => void;
  onClose: () => void;
}

export default function ProductPickerModal({ visible, produits, selectedIds, onToggle, onClose }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return produits;
    const q = search.toLowerCase();
    return produits.filter(
      (p) => p.nom_produit.toLowerCase().includes(q) || (p.categorie || '').toLowerCase().includes(q)
    );
  }, [produits, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Produits vendus</Text>
          <Text style={styles.subtitle}>Sélection multiple — un PDV peut vendre plusieurs produits</Text>

          <TextInput
            style={styles.search}
            placeholder="Rechercher un produit…"
            placeholderTextColor={colors.ink[400]}
            value={search}
            onChangeText={setSearch}
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            style={{ maxHeight: 360 }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <Text style={styles.empty}>Aucun produit trouvé.</Text>
            }
            renderItem={({ item }) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.item, isSelected && styles.itemSelected]}
                  onPress={() => onToggle(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.nom_produit}</Text>
                    {item.categorie ? <Text style={styles.itemCategory}>{item.categorie}</Text> : null}
                  </View>
                  {item.prix_unitaire ? (
                    <Text style={styles.itemPrice}>
                      {Number(item.prix_unitaire).toLocaleString('fr-FR')} FCFA
                    </Text>
                  ) : null}
                  <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <Button title={`Valider (${selectedIds.length})`} onPress={onClose} style={{ marginTop: 12 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(18,18,24,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    paddingBottom: 28,
    ...shadow.popover,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ink[200],
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink[900] },
  subtitle: { fontSize: 12, color: colors.ink[500], marginTop: 2, marginBottom: 14 },
  search: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
    color: colors.ink[900],
  },
  separator: { height: 1, backgroundColor: colors.ink[50] },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  itemSelected: {},
  itemName: { fontSize: 14, fontWeight: '700', color: colors.ink[800] },
  itemCategory: { fontSize: 12, color: colors.ink[400], marginTop: 2 },
  itemPrice: { fontSize: 12, fontWeight: '700', color: colors.primary[600] },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.ink[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  empty: { textAlign: 'center', color: colors.ink[400], paddingVertical: 24 },
});
