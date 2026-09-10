# Tracking PDV

Système de géolocalisation et suivi des Points de Vente (PDV) avec application mobile Android et plateforme web d'administration.

## 📋 Description du projet

Le projet Tracking PDV permet de :
- Géolocaliser les Points de Vente en temps réel
- Suivre les déplacements des commerciaux sur le terrain
- Saisir les ventes avec position GPS automatique
- Définir des zones de géo-clôture (geofencing) avec alertes
- Générer des rapports Excel professionnels
- Visualiser les données sur une carte interactive

## 🏗️ Architecture du projet

```
trackingpdv/
├── backend/           # API REST Node.js + Socket.IO
│   ├── src/
│   │   ├── controllers/  # Contrôleurs API
│   │   ├── models/       # Modèles Sequelize (MySQL)
│   │   ├── routes/       # Routes Express
│   │   ├── middleware/   # Middleware (auth, validation)
│   │   ├── services/     # Services métier (geofencing)
│   │   ├── sockets/      # Gestion WebSocket
│   │   ├── utils/        # Utilitaires (logger)
│   │   └── config/       # Configuration (DB, etc.)
│   ├── tests/
│   └── package.json
│
├── frontend/          # Dashboard React + TypeScript
│   ├── src/
│   │   ├── components/   # Composants React réutilisables
│   │   ├── pages/        # Pages (Dashboard, PDV, etc.)
│   │   ├── services/     # Services API
│   │   ├── contexts/     # Contextes React (auth, etc.)
│   │   ├── hooks/        # Hooks personnalisés
│   │   ├── utils/        # Utilitaires
│   │   └── styles/       # Styles (Tailwind CSS)
│   ├── public/
│   └── package.json
│
├── mobile/            # Application Android (Kotlin)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/trackingpdv/
│   │   │   │   ├── data/
│   │   │   │   │   ├── local/       # Room Database
│   │   │   │   │   ├── remote/      # Retrofit API
│   │   │   │   │   └── repository/  # Repository pattern
│   │   │   │   ├── ui/
│   │   │   │   │   ├── main/        # MainActivity
│   │   │   │   │   ├── onboarding/  # Écran d'inscription
│   │   │   │   │   ├── vente/       # Saisie des ventes
│   │   │   │   │   └── settings/    # Paramètres
│   │   │   │   ├── service/         # Services (Location)
│   │   │   │   └── utils/           # Utilitaires
│   │   │   └── res/                 # Resources Android
│   │   └── build.gradle
│   └── build.gradle
│
├── shared/            # Types/interfaces communs (optionnel)
├── docs/              # Documentation technique
└── README.md
```

## 🛠 Stack technique

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Base de données**: MySQL avec Sequelize ORM
- **Temps réel**: Socket.IO
- **Authentification**: JWT
- **Reporting**: ExcelJS
- **Geofencing**: Turf.js

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Routing**: React Router
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **UI**: Tailwind CSS
- **Cartographie**: Leaflet.js
- **Graphiques**: Chart.js / Recharts

### Mobile (Android)
- **Langage**: Kotlin
- **Architecture**: MVVM
- **Géolocalisation**: Google Play Services (FusedLocationProvider)
- **Base de données locale**: Room (SQLite)
- **API**: Retrofit + OkHttp
- **Coroutines**: Kotlin Coroutines
- **Service en tâche de fond**: WorkManager + Foreground Service

## 🚀 Installation et démarrage

### Prérequis
- Node.js 18+
- MySQL 8.0+
- Android Studio (pour le développement mobile)
- Git

### Configuration de la base de données

1. Créer la base de données MySQL :
```sql
CREATE DATABASE tracking_pdv CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Configurer les variables d'environnement dans `backend/.env` :
```bash
cp backend/.env.example backend/.env
# Éditer backend/.env avec vos configuration MySQL, JWT, etc.
```

### Backend

```bash
cd backend
npm install
npm run dev  # Développement (port 3000)
npm start    # Production
```

### Frontend

```bash
cd frontend
npm install
npm run dev  # Développement (port 3000)
npm run build # Production
```

### Mobile (Android)

1. Ouvrir le projet dans Android Studio
2. Configurer l'URL de l'API dans `mobile/app/src/main/java/com/trackingpdv/data/remote/RetrofitClient.kt`
3. Compiler et installer sur l'émulateur ou un appareil

```bash
cd mobile
./gradlew assembleDebug  # Build debug
./gradlew assembleRelease # Build release
```

## 📡 API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/refresh` - Rafraîchir token
- `GET /api/auth/me` - Profil utilisateur

### Points de Vente (PDV)
- `GET /api/pdv` - Liste des PDV
- `POST /api/pdv` - Créer un PDV
- `GET /api/pdv/:id` - Détail d'un PDV
- `PUT /api/pdv/:id` - Modifier un PDV
- `DELETE /api/pdv/:id` - Supprimer un PDV

### Ventes
- `GET /api/ventes` - Liste des ventes
- `POST /api/ventes` - Créer une vente
- `POST /api/ventes/batch` - Créer plusieurs ventes

### Positions GPS
- `GET /api/positions` - Liste des positions
- `POST /api/positions` - Créer une position
- `POST /api/positions/batch` - Créer plusieurs positions

### Geofencing
- `GET /api/geofence` - Liste des zones
- `POST /api/geofence` - Créer une zone
- `POST /api/geofence/:id/assign-pdv` - Assigner un PDV à une zone
- `POST /api/geofence/check-position` - Vérifier si une position est dans une zone

### Alertes
- `GET /api/alertes` - Liste des alertes
- `PUT /api/alertes/:id/traiter` - Traiter une alerte

### Dashboard
- `GET /api/dashboard/kpi` - Indicateurs clés
- `GET /api/dashboard/export/excel` - Export Excel

## 🔐 Sécurité

- Chiffrement des communications (HTTPS/TLS)
- Authentification JWT avec expiration
- Hashage des mots de passe (bcrypt)
- Gestion des rôles et permissions
- Validation des entrées
- Rate limiting

## 📱 Fonctionnalités mobile

### Onboarding
- Capture automatique de la position GPS
- Saisie obligatoire du MSISDN
- Enregistrement du PDV sur le serveur

### Saisie des ventes
- Formulaire de saisie terrain
- Capture automatique de la position
- Mode hors-ligne avec synchronisation différée

### Suivi GPS
- Service en tâche de fond
- Envoi périodique des positions
- Notification persistante

## 🗺️ Fonctionnalités Dashboard

### Carte temps réel
- Visualisation des PDV sur Leaflet
- Mise à jour en temps réel via WebSocket
- Filtres par zone, commercial, période

### Geofencing
- Création de zones (cercle/polygone)
- Alertes automatiques en cas de sortie de zone
- Historique des alertes

### Reporting
- Export Excel professionnel
- Graphiques et statistiques
- Filtres personnalisables

## 📝 Documentation

- [Document de cadrage](Tracking_PDV_Document_Cadrage.md) - Spécifications fonctionnelles détaillées
- [Guide de développement](docs/DEVELOPMENT.md) - Guide pour les développeurs
- [Guide de déploiement](docs/DEPLOYMENT.md) - Instructions de déploiement

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/ma-fonctionnalite`)
3. Commit (`git commit -m 'Ajout de ma fonctionnalité'`)
4. Push (`git push origin feature/ma-fonctionnalite`)
5. Créer une Pull Request

## 📄 Licence

Ce projet est propriétaire. Tous droits réservés.

## 👥 Équipe

- Développement Backend: Node.js/Express
- Développement Frontend: React/TypeScript
- Développement Mobile: Android/Kotlin
- Base de données: MySQL

## 📞 Support

Pour toute question ou problème, veuillez contacter l'équipe de développement.
