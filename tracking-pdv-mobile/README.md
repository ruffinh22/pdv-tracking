# Tracking PDV Mobile - Application Android

Application mobile Android pour le suivi de points de vente et la saisie des ventes terrain.

## 🎯 Fonctionnalités

### ✅ Implémentées
- **Onboarding automatique avec GPS**
  - Acquisition automatique de la position GPS au premier lancement
  - Saisie obligatoire du numéro MSISDN comme identifiant
  - Création automatique du PDV sur le serveur
  - Sauvegarde locale des identifiants

- **Saisie des ventes terrain**
  - Formulaire de saisie avec sélection de produits
  - Saisie du concessionnaire, vendeur et contact
  - Position GPS automatique du lieu de saisie
  - Horodatage automatique
  - Possibilité de plusieurs saisies par jour

- **Mode hors-ligne avec synchronisation**
  - Base de données SQLite locale pour stockage
  - File d'attente locale pour ventes et positions
  - Synchronisation automatique quand connexion rétablie
  - Indicateur de statut de synchronisation

- **Suivi de position en temps réel**
  - Envoi périodique de la position GPS (toutes les 60 secondes)
  - Fonctionnement en arrière-plan (foreground service)
  - Sauvegarde locale des positions
  - Synchronisation automatique avec le serveur

- **Historique local**
  - Liste des ventes avec statut de synchronisation
  - Historique des positions GPS
  - Statistiques rapides (PDV actifs, ventes en attente)

## 🚀 Installation

### Prérequis
- Node.js 18+
- Android Studio (pour développement)
- Expo CLI
- Appareil Android ou émulateur

### Configuration

1. **Installer les dépendances**
```bash
cd tracking-pdv-mobile
npm install
```

2. **Configurer l'URL du backend**
Modifier l'URL dans les fichiers suivants:
- `App.tsx` (ligne 5)
- `services/syncService.js` (ligne 6)
- `tasks/locationTask.js` (ligne 4)

Remplacer `http://192.168.1.100:3001/api` par l'IP de votre backend.

3. **Lancer l'application**
```bash
npm start
```

4. **Scanner le QR code** avec l'app Expo Go sur Android

## 📱 Utilisation

### Premier lancement (Onboarding)
1. Lancer l'application
2. Accepter les permissions GPS
3. Attendre l'acquisition de la position GPS
4. Saisir votre numéro MSISDN
5. Cliquer sur "Créer mon compte"
6. Le PDV est créé automatiquement sur le serveur

### Saisie des ventes
1. Cliquer sur "Saisie Ventes" dans la navigation
2. Sélectionner ou saisir le produit
3. Remplir les informations (concessionnaire, vendeur, contact)
4. La position GPS est capturée automatiquement
5. Cliquer sur "Enregistrer la vente"
6. La vente est sauvegardée localement et synchronisée si connecté

### Synchronisation
- Cliquez sur le bouton "🔄 Sync" pour synchroniser manuellement
- La synchronisation est automatique quand la connexion est rétablie
- Vérifiez le statut dans l'historique

### Tracking GPS
- Le tracking démarre automatiquement après l'onboarding
- La position est envoyée toutes les 60 secondes
- Une notification persistante indique que le tracking est actif
- Les positions sont sauvegardées localement si hors-ligne

## 🔧 Configuration Backend

L'application mobile se connecte au backend existant. Assurez-vous que:

1. **Le backend est accessible** sur le réseau
2. **Les routes mobiles sont activées**:
   - `POST /api/pdv/mobile/register` - Enregistrement mobile
   - `POST /api/pdv/mobile/login` - Connexion mobile
   - `POST /api/ventes` - Envoi des ventes
   - `POST /api/positions` - Envoi des positions

3. **Le backend autorise les requêtes CORS** depuis l'IP mobile

## 📊 Structure de l'application

```
tracking-pdv-mobile/
├── App.tsx                 # Application principale
├── app.json               # Configuration Expo
├── components/
│   └── SalesForm.tsx      # Formulaire de saisie des ventes
├── database/
│   └── initDB.js          # Initialisation SQLite
├── services/
│   └── syncService.js     # Service de synchronisation
└── tasks/
    └── locationTask.js    # Tâche de tracking en arrière-plan
```

## 🔐 Permissions Android

L'application nécessite les permissions suivantes:
- `ACCESS_FINE_LOCATION` - Position GPS précise
- `ACCESS_COARSE_LOCATION` - Position GPS approximative
- `FOREGROUND_SERVICE` - Service en arrière-plan
- `POST_NOTIFICATIONS` - Notifications
- `SCHEDULE_EXACT_ALARM` - Alarmes précises
- `WAKE_LOCK` - Empêcher la mise en veille

## 🐛 Dépannage

### Problème: Impossible de se connecter au backend
- Vérifiez que le backend est accessible
- Modifiez l'IP dans les fichiers de configuration
- Vérifiez que le pare-feu autorise les connexions

### Problème: GPS ne fonctionne pas
- Vérifiez que les permissions GPS sont accordées
- Activez le GPS sur l'appareil
- Vérifiez que le location est activé dans les paramètres

### Problème: Le tracking ne fonctionne pas en arrière-plan
- Vérifiez que l'application est exemptée des restrictions d'économie d'énergie
- Vérifiez que le foreground service est autorisé
- Sur certains appareils, désactivez "Optimiser l'utilisation de la batterie"

## 📝 Notes de développement

### Mode développement
Pour le développement sur Android:
```bash
npm run android
```

### Build de production
Pour créer un APK de production:
```bash
eas build --platform android
```

### Base de données locale
La base de données SQLite contient:
- `ventes` - Ventes enregistrées localement
- `positions` - Positions GPS enregistrées localement
- `metadata` - Métadonnées de l'application

## 🔄 Workflow de synchronisation

1. **Enregistrement local**:
   - Vente/Position → SQLite locale
   - Statut: `en_attente`

2. **Synchronisation**:
   - Vérification de la connexion
   - Envoi des données au serveur
   - Mise à jour du statut: `synchronise = 1`

3. **Mode hors-ligne**:
   - Accumulation dans la file d'attente
   - Synchronisation automatique à la reconnexion

## 📱 Compatibilité

- **Android**: 8.0+ (API 26+)
- **Expo SDK**: 57.0.0
- **React Native**: 0.76+

## 🚨 Limitations

- Le tracking s'arrête si l'utilisateur ferme l'application
- Sur certains appareils, le tracking peut être limité par les restrictions Android
- Le mode hors-ligne nécessite une synchronisation manuelle sur certains appareils

## 📞 Support

Pour les problèmes ou questions, contactez l'équipe de développement.