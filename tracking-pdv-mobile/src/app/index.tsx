import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Modal } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { initDatabase } from '../../database/initDB';
import syncService from '../../services/syncService';
import { CONFIG } from '../../config';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [msisdn, setMsisdn] = useState('');
  const [location, setLocation] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [pendingVentes, setPendingVentes] = useState<any[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  
  // État du formulaire de vente
  const [selectedProduits, setSelectedProduits] = useState<any[]>([]);
  const [nomConcessionnaire, setNomConcessionnaire] = useState('');
  const [nomVendeur, setNomVendeur] = useState('');
  const [contactVendeur, setContactVendeur] = useState('');
  const [salesLocation, setSalesLocation] = useState<any>(null);
  const [produitsList, setProduitsList] = useState<any[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialiser la base de données
      await initDatabase();

      // Initialiser le service de synchronisation
      await syncService.initDB();
      
      // Vérifier si déjà onboardé
      const onboarded = await SecureStore.getItemAsync('isOnboarded');
      if (onboarded === 'true') {
        setIsOnboarded(true);
        const savedMsisdn = await SecureStore.getItemAsync('msisdn');
        setMsisdn(savedMsisdn || '');
        
        // Charger l'historique complet
        const ventes = await syncService.getVentesHistory();
        setPendingVentes(ventes);
        
        // Démarrer le tracking en arrière-plan
        await startBackgroundTracking();
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error);
      setLoading(false);
    }
  };

  const handleOnboarding = async () => {
    if (!msisdn || msisdn.length < 10) {
      alert('Veuillez entrer un numéro MSISDN valide');
      return;
    }

    try {
      setLoading(true);
      
      // Obtenir la position GPS
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('L\'application a besoin de votre position GPS');
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: true,
      });

      setLocation(currentLocation);

      // Essayer de se connecter d'abord
      try {
        const loginResponse = await fetch(`${CONFIG.API_BASE_URL}/pdv/mobile/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msisdn })
        });
        
        if (loginResponse.ok) {
          const pdv = await loginResponse.json();
          
          // Sauvegarder localement
          await SecureStore.setItemAsync('pdvId', pdv.id.toString());
          await SecureStore.setItemAsync('msisdn', msisdn);
          await SecureStore.setItemAsync('isOnboarded', 'true');

          setIsOnboarded(true);
          setLoading(false);
          
          // Démarrer le tracking en arrière-plan
          await startBackgroundTracking();
          
          alert('Connexion réussie!');
          return;
        }
      } catch (loginError) {
        console.log('PDV non trouvé, création d\'un nouveau compte...');
      }

      // Si la connexion échoue, créer un nouveau PDV
      const pdvData = {
        nom_pdv: `PDV ${msisdn}`,
        msisdn_responsable: msisdn,
        latitude_creation: currentLocation.coords.latitude,
        longitude_creation: currentLocation.coords.longitude,
        statut: 'actif',
        device_info: {
          platform: 'android',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch(`${CONFIG.API_BASE_URL}/pdv/mobile/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdvData)
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la création du PDV');
      }
      
      const result = await response.json();
      
      if (!result || !result.id) {
        throw new Error('Réponse invalide du serveur');
      }
      
      // Sauvegarder localement
      await SecureStore.setItemAsync('pdvId', result.id.toString());
      await SecureStore.setItemAsync('msisdn', msisdn);
      await SecureStore.setItemAsync('isOnboarded', 'true');

      setIsOnboarded(true);
      setLoading(false);
      
      // Démarrer le tracking en arrière-plan
      await startBackgroundTracking();
      
      alert('Compte créé avec succès!');
    } catch (error) {
      console.error('Erreur lors de l\'onboarding:', error);
      setLoading(false);
      alert('Impossible de créer votre compte. Vérifiez votre connexion.');
    }
  };

  const startBackgroundTracking = async () => {
    try {
      setIsTracking(true);
      
      // Demander les permissions de background location
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        alert('Permission GPS requise');
        return;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        alert('Permission background GPS requise');
        return;
      }

      // Écouter les mises à jour de position en arrière-plan avec haute précision
      const subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: CONFIG.LOCATION_CONFIG.TRACKING_INTERVAL,
        distanceInterval: CONFIG.LOCATION_CONFIG.TRACKING_DISTANCE,
        // Options supplémentaires pour une meilleure précision
        mayShowUserSettingsDialog: true,
      }, (newLocation) => {
        // Sauvegarder la position localement
        syncService.savePositionLocally({
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude,
          horodatage: new Date().toISOString(),
          accuracy: newLocation.coords.accuracy
        });
      });

      console.log('Tracking GPS en arrière-plan démarré');
    } catch (error) {
      console.error('Erreur lors du démarrage du tracking:', error);
      setIsTracking(false);
    }
  };

  const syncNow = async () => {
    try {
      const result = await syncService.autoSync();
      if (result) {
        alert(`Synchronisation: ${result.synced} éléments synchronisés`);
      } else {
        alert('Synchronisation terminée');
      }
      
      // Recharger l'historique complet
      const allVentes = await syncService.getVentesHistory();
      setPendingVentes(allVentes);
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      alert('Erreur lors de la synchronisation');
    }
  };

  const logout = async () => {
    try {
      setIsTracking(false);
      await SecureStore.deleteItemAsync('pdvId');
      await SecureStore.deleteItemAsync('msisdn');
      await SecureStore.deleteItemAsync('isOnboarded');
      setIsOnboarded(false);
      setMsisdn('');
      setCurrentScreen('home');
      setLocation(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const handleSalesSubmit = async () => {
    if (selectedProduits.length === 0) {
      alert('Veuillez sélectionner au moins un produit');
      return;
    }

    setIsSubmitting(true);

    // Toujours obtenir la position GPS au moment de la soumission
    let currentGPSLocation;
    try {
      console.log('Acquisition GPS pour la vente...');
      currentGPSLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: true,
      });
      console.log('Position GPS obtenue:', currentGPSLocation);
    } catch (error) {
      console.error('Erreur GPS:', error);
      alert('Impossible d\'obtenir votre position GPS');
      setIsSubmitting(false);
      return;
    }

    if (!currentGPSLocation) {
      alert('Position GPS requise');
      setIsSubmitting(false);
      return;
    }

    try {
      // Créer une vente pour chaque produit sélectionné
      let successCount = 0;
      for (const prod of selectedProduits) {
        const venteData = {
          produit: prod.nom_produit,
          nom_concessionnaire: nomConcessionnaire,
          nom_vendeur: nomVendeur,
          contact_vendeur: contactVendeur,
          montant: Number(prod.prix_unitaire) || 0,
          latitude: currentGPSLocation.coords.latitude,
          longitude: currentGPSLocation.coords.longitude,
          horodatage: new Date().toISOString()
        };

        console.log('Tentative d\'enregistrement de la vente:', venteData);

        const saved = await syncService.saveVenteLocally(venteData);
        if (saved) {
          successCount++;
        }
      }

      // Synchroniser toutes les ventes
      await syncService.autoSync();

      alert(`${successCount} vente(s) enregistrée(s) avec succès`);

      // Reset form
      setSelectedProduits([]);
      setNomConcessionnaire('');
      setNomVendeur('');
      setContactVendeur('');

      // Recharger l'historique complet
      const allVentes = await syncService.getVentesHistory();
      console.log('Historique chargé:', allVentes);
      setPendingVentes(allVentes);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la vente:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!isOnboarded) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>📱 Tracking PDV</Text>
          <Text style={styles.subtitle}>Application mobile pour le suivi de points de vente</Text>
          
          <View style={styles.locationInfo}>
            {location ? (
              <>
                <Text style={styles.locationText}>📍 Position GPS:</Text>
                <Text style={styles.locationData}>Lat: {location.coords.latitude.toFixed(6)}</Text>
                <Text style={styles.locationData}>Lng: {location.coords.longitude.toFixed(6)}</Text>
              </>
            ) : (
              <Text style={styles.locationText}>📍 Acquisition GPS...</Text>
            )}
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Numéro MSISDN</Text>
            <TextInput
              style={styles.input}
              placeholder="+33612345678"
              value={msisdn}
              onChangeText={setMsisdn}
              keyboardType="phone-pad"
              maxLength={15}
            />
            <Text style={styles.helper}>Ce numéro identifie votre compte PDV</Text>

            <TouchableOpacity 
              style={styles.button}
              onPress={handleOnboarding}
              disabled={loading || !msisdn}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Créer mon compte</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📱 Tracking PDV</Text>
        <View style={styles.headerRight}>
          <Text style={styles.msisdn}>{msisdn}</Text>
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation */}
      <View style={styles.nav}>
        <TouchableOpacity 
          style={[styles.navItem, currentScreen === 'home' && styles.navItemActive]}
          onPress={() => setCurrentScreen('home')}
        >
          <Text style={styles.navText}>🏠 Accueil</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navItem, currentScreen === 'sales' && styles.navItemActive]}
          onPress={async () => {
            setCurrentScreen('sales');
            // Obtenir la position GPS pour la saisie des ventes
            try {
              const currentGPS = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.BestForNavigation,
                mayShowUserSettingsDialog: true,
              });
              setSalesLocation(currentGPS);
            } catch (error) {
              console.error('Erreur GPS:', error);
            }
            
            // Charger la liste des produits
            try {
              console.log('Chargement des produits depuis:', `${CONFIG.API_BASE_URL}/produits/list`);
              const response = await fetch(`${CONFIG.API_BASE_URL}/produits/list`);
              console.log('Réponse produits status:', response.status);
              const payload = await response.json();
              console.log('Produits reçus (brut):', payload);
              // Normaliser la réponse - peut être {data: [...]} ou [...]
              const produitsList = Array.isArray(payload) ? payload : (payload.data || []);
              console.log('Produits normalisés:', produitsList);
              setProduitsList(produitsList);
            } catch (error) {
              console.error('Erreur lors du chargement des produits:', error);
            }
          }}
        >
          <Text style={styles.navText}>📝 Saisie Ventes</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navItem, currentScreen === 'history' && styles.navItemActive]}
          onPress={() => setCurrentScreen('history')}
        >
          <Text style={styles.navText}>📊 Historique</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.syncButton}
          onPress={syncNow}
        >
          <Text style={styles.syncButtonText}>🔄 Sync</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.contentContainer}>
        {currentScreen === 'home' && (
          <View style={styles.homeContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📍 Statut du Tracking</Text>
              <Text style={styles.cardText}>
                {isTracking ? '✅ Actif' : '❌ Inactif'}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>📊 Ventes en attente</Text>
              <Text style={styles.cardNumber}>{pendingVentes.length}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>📱 Votre Position</Text>
              {location && (
                <>
                  <Text style={styles.cardText}>
                    Lat: {location.coords.latitude.toFixed(6)}
                  </Text>
                  <Text style={styles.cardText}>
                    Lng: {location.coords.longitude.toFixed(6)}
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        {currentScreen === 'sales' && (
          <View style={styles.salesContent}>
            <Text style={styles.salesTitle}>📝 Saisie des Ventes</Text>
            <Text style={styles.salesSubtitle}>Enregistrez vos ventes sur le terrain</Text>
            
            <View style={styles.locationCard}>
              {salesLocation ? (
                <>
                  <Text style={styles.locationTitle}>📍 Position GPS</Text>
                  <Text style={styles.locationData}>Lat: {salesLocation.coords.latitude.toFixed(6)}</Text>
                  <Text style={styles.locationData}>Lng: {salesLocation.coords.longitude.toFixed(6)}</Text>
                </>
              ) : (
                <View style={styles.locationLoading}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text style={styles.locationLoadingText}>Acquisition GPS en cours...</Text>
                </View>
              )}
            </View>

            <View style={styles.salesForm}>
              <Text style={styles.label}>Produits vendus</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowProductModal(true)}
              >
                <Text style={[styles.pickerButtonText, selectedProduits.length > 0 && { color: '#374151' }]}>
                  {selectedProduits.length > 0
                    ? `${selectedProduits.length} produit(s) sélectionné(s)`
                    : 'Sélectionner des produits'}
                </Text>
              </TouchableOpacity>

              {selectedProduits.length > 0 && (
                <View style={styles.selectedProductsContainer}>
                  {selectedProduits.map((prod, index) => (
                    <View key={index} style={styles.selectedProductItem}>
                      <Text style={styles.selectedProductName}>{prod.nom_produit}</Text>
                      <Text style={styles.selectedProductPrice}>
                        {Number(prod.prix_unitaire).toLocaleString('fr-FR')} FCFA
                      </Text>
                      <TouchableOpacity
                        style={styles.removeProductButton}
                        onPress={() => {
                          setSelectedProduits(selectedProduits.filter((_, i) => i !== index));
                        }}
                      >
                        <Text style={styles.removeProductText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <Text style={styles.totalAmount}>
                    Total: {selectedProduits.reduce((sum, prod) => sum + Number(prod.prix_unitaire), 0).toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>
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

              <Text style={styles.info}>📅 Date: {new Date().toLocaleDateString('fr-FR')}</Text>
              <Text style={styles.info}>⏰ Heure: {new Date().toLocaleTimeString('fr-FR')}</Text>

              <TouchableOpacity
                style={[styles.submitButton, (!salesLocation || selectedProduits.length === 0) && styles.submitButtonDisabled]}
                onPress={handleSalesSubmit}
                disabled={!salesLocation || selectedProduits.length === 0 || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Enregistrer la vente</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {currentScreen === 'history' && (
          <View style={styles.historyContent}>
            <Text style={styles.historyTitle}>Historique des Ventes</Text>
            {pendingVentes.length > 0 ? (
              pendingVentes.map((vente) => (
                <View key={vente.id} style={styles.historyItem}>
                  <Text style={styles.historyProduct}>{vente.produit}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(vente.horodatage).toLocaleString('fr-FR')}
                  </Text>
                  {vente.montant && (
                    <Text style={styles.historyMontant}>
                      {Number(vente.montant).toLocaleString('fr-FR')} FCFA
                    </Text>
                  )}
                  <View style={[
                    styles.historyStatus,
                    vente.synchronise === 1 ? styles.synced : styles.pending
                  ]}>
                    <Text style={styles.statusText}>
                      {vente.synchronise === 1 ? '✅ Synchronisé' : '⏳ En attente'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Aucune vente enregistrée</Text>
            )}
            
            <TouchableOpacity 
              style={styles.loadHistoryButton}
              onPress={async () => {
                const allVentes = await syncService.getVentesHistory();
                setPendingVentes(allVentes);
              }}
            >
              <Text style={styles.loadHistoryButtonText}>Charger tout l'historique</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal de sélection de produit */}
      <Modal
        visible={showProductModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sélectionner des produits</Text>
            <ScrollView style={styles.productList}>
              {produitsList && produitsList.length > 0 && produitsList.map((prod: any) => {
                const isSelected = selectedProduits.some((p) => p.id === prod.id);
                return (
                  <TouchableOpacity
                    key={prod.id}
                    style={[styles.productItem, isSelected && styles.productItemSelected]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedProduits(selectedProduits.filter((p) => p.id !== prod.id));
                      } else {
                        setSelectedProduits([...selectedProduits, prod]);
                      }
                    }}
                  >
                    <View style={styles.productItemContent}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{prod.nom_produit}</Text>
                        <Text style={styles.productCategory}>{prod.categorie || ''}</Text>
                        {prod.prix_unitaire && (
                          <Text style={styles.productPrice}>
                            {Number(prod.prix_unitaire).toLocaleString('fr-FR')} FCFA
                          </Text>
                        )}
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && <Text style={styles.checkboxText}>✓</Text>}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowProductModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  locationInfo: {
    backgroundColor: '#e0f2fe',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  locationText: {
    fontSize: 14,
    color: '#0369a1',
    marginBottom: 5,
  },
  locationData: {
    fontSize: 12,
    color: '#075985',
    marginBottom: 2,
  },
  form: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  helper: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#1f2937',
    padding: 15,
    paddingTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  msisdn: {
    color: '#ffffff',
    fontSize: 14,
    marginRight: 15,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 12,
  },
  nav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  navItem: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  navItemActive: {
    borderBottomColor: '#3b82f6',
  },
  navText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 15,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  homeContent: {
    gap: 15,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  cardText: {
    fontSize: 14,
    color: '#6b7280',
  },
  cardNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  salesContent: {
    padding: 20,
  },
  salesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10,
  },
  salesSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
  },
  locationCard: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
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
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationLoadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  salesForm: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  submitButton: {
    backgroundColor: '#22c55e',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 10,
    marginBottom: 5,
  },
  historyContent: {
    gap: 10,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
  },
  historyItem: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyProduct: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  historyDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  historyMontant: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  historyStatus: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  synced: {
    backgroundColor: '#dcfce7',
  },
  pending: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 30,
  },
  loadHistoryButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  loadHistoryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  selectedProductsContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  selectedProductItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  selectedProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  selectedProductPrice: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  removeProductButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  removeProductText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 10,
    textAlign: 'right',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  productItemSelected: {
    backgroundColor: '#dbeafe',
  },
  productItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkboxText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  modalCloseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
  },
  productList: {
    maxHeight: 300,
  },
  productItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  productCategory: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 5,
  },
  productPrice: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
    marginTop: 5,
  },
  modalCloseButton: {
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  modalCloseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});