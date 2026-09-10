import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SalesForm from './components/SalesForm';
import syncService from './services/syncService';
import { CONFIG } from './config';
import { initDatabase } from './database/initDB';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [msisdn, setMsisdn] = useState('');
  const [location, setLocation] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [pendingVentes, setPendingVentes] = useState<any[]>([]);
  const [isTracking, setIsTracking] = useState(false);

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
      const onboarded = await AsyncStorage.getItem('isOnboarded');
      if (onboarded === 'true') {
        setIsOnboarded(true);
        const savedMsisdn = await AsyncStorage.getItem('msisdn');
        setMsisdn(savedMsisdn || '');
        
        // Charger les ventes en attente
        const ventes = await syncService.getPendingVentes();
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
        accuracy: Location.Accuracy.High,
      });

      setLocation(currentLocation);

      // Créer le PDV sur le serveur
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
      
      const result = await response.json();
      
      // Sauvegarder localement
      await AsyncStorage.setItem('pdvId', result.id.toString());
      await AsyncStorage.setItem('msisdn', msisdn);
      await AsyncStorage.setItem('isOnboarded', 'true');

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

      // Écouter les mises à jour de position en arrière-plan
      const subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: CONFIG.LOCATION_CONFIG.TRACKING_INTERVAL,
        distanceInterval: CONFIG.LOCATION_CONFIG.TRACKING_DISTANCE,
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
      alert(`Synchronisation: ${result.synced} éléments synchronisés`);
      
      // Recharger les ventes en attente
      const ventes = await syncService.getPendingVentes();
      setPendingVentes(ventes);
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      alert('Erreur lors de la synchronisation');
    }
  };

  const logout = async () => {
    try {
      await Location.stopLocationUpdatesAsync();
      setIsTracking(false);
      await AsyncStorage.clear();
      setIsOnboarded(false);
      setMsisdn('');
      setCurrentScreen('home');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
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
          onPress={() => setCurrentScreen('sales')}
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

        {currentScreen === 'sales' && <SalesForm />}

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
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
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
});