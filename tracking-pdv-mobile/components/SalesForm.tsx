import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import syncService from '../services/syncService';
import { CONFIG } from '../config';

const PRODUCTS = [
  'Produit A',
  'Produit B', 
  'Produit C',
  'Produit D',
  'Produit E',
  'Autre'
];

export default function SalesForm() {
  const [loading, setLoading] = useState(false);
  const [produit, setProduit] = useState('');
  const [customProduit, setCustomProduit] = useState('');
  const [nomConcessionnaire, setNomConcessionnaire] = useState('');
  const [nomVendeur, setNomVendeur] = useState('');
  const [contactVendeur, setContactVendeur] = useState('');
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'application a besoin de votre position GPS');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCurrentLocation(location);
    } catch (error) {
      console.error('Erreur lors de l\'acquisition de la position:', error);
      Alert.alert('Erreur', 'Impossible d\'obtenir votre position GPS');
    }
  };

  const handleSubmit = async () => {
    if (!produit || (produit === 'Autre' && !customProduit)) {
      Alert.alert('Erreur', 'Veuillez sélectionner ou saisir un produit');
      return;
    }

    if (!currentLocation) {
      Alert.alert('Erreur', 'Position GPS requise. Attendez l\'acquisition...');
      return;
    }

    setLoading(true);

    const finalProduit = produit === 'Autre' ? customProduit : produit;

    const venteData = {
      produit: finalProduit,
      nom_concessionnaire: nomConcessionnaire,
      nom_vendeur: nomVendeur,
      contact_vendeur: contactVendeur,
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
      horodatage: new Date().toISOString()
    };

    try {
      // Sauvegarder localement (mode offline par défaut)
      const saved = await syncService.saveVenteLocally(venteData);
      
      if (saved) {
        // Tenter de synchroniser si connecté
        await syncService.autoSync();
        
        Alert.alert(
          'Succès',
          'Vente enregistrée avec succès',
          [
            { text: 'OK', onPress: () => {
              // Reset form
              setProduit('');
              setCustomProduit('');
              setNomConcessionnaire('');
              setNomVendeur('');
              setContactVendeur('');
            }}
          ]
        );
      } else {
        Alert.alert('Erreur', 'Impossible d\'enregistrer la vente localement');
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la vente:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la vente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📝 Saisie des Ventes</Text>
        <Text style={styles.headerSubtitle}>Enregistrez vos ventes sur le terrain</Text>
      </View>

      <View style={styles.locationCard}>
        {currentLocation ? (
          <>
            <Text style={styles.locationTitle}>📍 Position GPS</Text>
            <Text style={styles.locationText}>
              Lat: {currentLocation.coords.latitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              Lng: {currentLocation.coords.longitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              Précision: {currentLocation.coords.accuracy.toFixed(2)}m
            </Text>
            <Button 
              title="Actualiser position" 
              onPress={getCurrentLocation}
              color="#3b82f6"
              style={styles.updateButton}
            />
          </>
        ) : (
          <View style={styles.locationLoading}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.locationLoadingText}>Acquisition GPS en cours...</Text>
          </View>
        )}
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Produit vendu</Text>
        <View style={styles.productContainer}>
          {PRODUCTS.map((prod) => (
            <Button
              key={prod}
              title={prod}
              onPress={() => {
                setProduit(prod);
                setCustomProduit('');
              }}
              color={produit === produit ? '#3b82f6' : '#6b7280'}
              style={[
                styles.productButton,
                produit === prod && styles.productButtonActive
              ]}
            />
          ))}
        </View>

        {produit === 'Autre' && (
          <TextInput
            style={styles.input}
            placeholder="Saisir le nom du produit"
            value={customProduit}
            onChangeText={setCustomProduit}
          />
        )}

        <Text style={styles.label}>Nom du concessionnaire</Text>
        <TextInput
          style={styles.input}
          placeholder="Nom du concessionnaire"
          value={nomConcessionnaire}
          onChangeText={setNomConcessionnaire}
        />

        <Text style={styles.label}>Nom du vendeur</Text>
        <TextInput
          style={styles.input}
          placeholder="Votre nom"
          value={nomVendeur}
          onChangeText={setNomVendeur}
        />

        <Text style={styles.label}>Contact du vendeur</Text>
        <TextInput
          style={styles.input}
          placeholder="Numéro de téléphone"
          value={contactVendeur}
          onChangeText={setContactVendeur}
          keyboardType="phone-pad"
        />

        <Text style={styles.info}>
          📅 Date: {new Date().toLocaleDateString('fr-FR')}
        </Text>
        <Text style={styles.info}>
          ⏰ Heure: {new Date().toLocaleTimeString('fr-FR')}
        </Text>

        <Button
          title="Enregistrer la vente"
          onPress={handleSubmit}
          disabled={loading || !currentLocation}
          color="#22c55e"
          style={styles.submitButton}
        />

        {loading && (
          <ActivityIndicator size="large" color="#3b82f6" style={styles.loading} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1f2937',
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  locationCard: {
    backgroundColor: '#ffffff',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  locationText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 5,
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  locationLoadingText: {
    marginLeft: 10,
    color: '#6b7280',
  },
  updateButton: {
    marginTop: 10,
  },
  form: {
    padding: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 15,
  },
  productContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  productButton: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 15,
  },
  productButtonActive: {
    backgroundColor: '#3b82f6',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    marginBottom: 5,
  },
  info: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 10,
    marginBottom: 5,
  },
  submitButton: {
    marginTop: 20,
    paddingVertical: 12,
  },
  loading: {
    marginTop: 20,
  },
});