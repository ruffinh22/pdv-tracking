# Document de Cadrage — Projet « Tracking PDV »

**Géolocalisation, suivi et couverture des Points de Vente**

Version 1.0 — Septembre 2026

---

## 1. Contexte et objectifs

De nombreuses entreprises de distribution s'appuient sur un réseau de commerciaux/responsables chargés de démarcher et suivre des Points de Vente (PDV) sur le terrain. Sans outil dédié, il est difficile de :

- Savoir où se trouvent réellement les PDV et les commerciaux en temps réel ;
- Historiser les déplacements et vérifier la couverture géographique réelle du réseau ;
- Centraliser les informations saisies sur le terrain (produit vendu, concessionnaire, vendeur) ;
- Détecter automatiquement les sorties de zone (déplacements anormaux, PDV fictifs, etc.).

**Le projet Tracking PDV** répond à ce besoin en combinant :

1. Une **application mobile Android** installée chez/par le responsable du PDV, qui capture automatiquement la position GPS et les données de vente.
2. Une **plateforme web d'administration (dashboard)** qui centralise, visualise et exploite ces données en temps réel.

### Objectifs du projet

- Géolocaliser chaque PDV dès la première installation de l'application.
- Associer chaque PDV à un responsable identifié par son numéro MSISDN (numéro de ligne mobile).
- Permettre la saisie terrain des ventes (produit, concessionnaire, vendeur, contact).
- Suivre en temps réel la position des PDV sur une carte.
- Historiser les déplacements pour analyser la couverture terrain.
- Définir des zones de géo-clôture (**geofencing**) et déclencher des alertes en cas de sortie de zone.
- Générer des rapports Excel professionnels exportables à la demande.

---

## 2. Périmètre du projet

| Inclus | Exclus (hors périmètre v1) |
|---|---|
| Application Android (capture GPS, saisie, association MSISDN) | Application iOS |
| Plateforme web Node.js (dashboard, carte, reporting) | Facturation / paiement en ligne |
| Base de données MySQL centralisée | Application desktop lourde |
| Géofencing et alertes | Intégration ERP tierce (v2 potentielle) |
| Reporting Excel automatisé | Notifications push SMS (peut être ajouté en option) |

---

## 3. Architecture globale de la solution

```
                     ┌────────────────────────────┐
                     │   Application Mobile        │
                     │   Android (Kotlin/Java)     │
                     │  - Capture GPS auto          │
                     │  - Popup saisie MSISDN       │
                     │  - Saisie vente terrain       │
                     └───────────────┬────────────┘
                                     │ HTTPS / REST API (JSON)
                                     ▼
                     ┌────────────────────────────┐
                     │   Backend Node.js            │
                     │  (Express.js / NestJS)       │
                     │  - API REST                  │
                     │  - Auth JWT                  │
                     │  - Moteur de Geofencing       │
                     │  - Génération Reporting Excel │
                     │  - WebSocket (temps réel)     │
                     └───────────────┬────────────┘
                                     │ SQL
                                     ▼
                     ┌────────────────────────────┐
                     │   Base de données MySQL       │
                     │  (PDV, Users, Ventes, Positions,│
                     │   Zones Geofence, Alertes)     │
                     └────────────────────────────┘
                                     ▲
                                     │ HTTPS / WebSocket
                     ┌───────────────┴────────────┐
                     │   Plateforme Web Admin        │
                     │  (Dashboard responsive)       │
                     │  - Carte temps réel (Leaflet/  │
                     │    Google Maps API)            │
                     │  - Historique déplacements     │
                     │  - Gestion des zones            │
                     │  - Export Excel                │
                     └────────────────────────────┘
```

---

## 4. Application mobile Android

### 4.1 Fonctionnalités clés

1. **Premier lancement (onboarding automatique)**
   - À l'installation, l'application récupère automatiquement la position GPS de l'appareil (latitude/longitude, précision, horodatage).
   - Une **popup obligatoire** s'affiche pour demander au responsable de renseigner son **numéro MSISDN**.
   - Ce numéro sert d'identifiant unique et est associé au PDV nouvellement créé (couple Position GPS + MSISDN + métadonnées appareil).

2. **Saisie des ventes terrain**
   - Formulaire de saisie avec :
     - Produit vendu (liste déroulante ou saisie libre / catalogue produit)
     - Nom du concessionnaire
     - Nom du vendeur
     - Contact du vendeur (numéro de téléphone)
     - Position GPS automatique du lieu de saisie (capturée sans intervention manuelle)
     - Horodatage automatique
   - Possibilité de saisir plusieurs enregistrements par jour.
   - Mode **hors-ligne** avec synchronisation différée (file d'attente locale SQLite) si pas de réseau, puis envoi automatique dès que la connexion revient.

3. **Suivi de la position en temps réel**
   - Envoi périodique de la position GPS (ex. toutes les X minutes ou lors d'un déplacement significatif) au serveur via l'API REST/WebSocket.
   - Fonctionnement en tâche de fond (foreground service Android) avec notification persistante pour respecter les contraintes Android modernes (Doze mode, restrictions Android 12+).

4. **Historique local et statut de synchronisation**
   - Écran listant les dernières saisies avec statut (synchronisé / en attente).

### 4.2 Stack technique recommandée

| Composant | Choix recommandé |
|---|---|
| Langage | Kotlin (natif Android, recommandé par Google) |
| Architecture | MVVM (Model-View-ViewModel) |
| Géolocalisation | FusedLocationProviderClient (Google Play Services) |
| Stockage local | Room (SQLite) pour le mode hors-ligne |
| Réseau | Retrofit + OkHttp pour consommer l'API REST Node.js |
| Service en tâche de fond | WorkManager + Foreground Service |
| Notifications | Firebase Cloud Messaging (FCM) — alertes, rappels |
| Authentification | JWT stocké de manière sécurisée (EncryptedSharedPreferences) |

### 4.3 Permissions Android requises

- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION` (pour le suivi temps réel en tâche de fond)
- `INTERNET`
- `FOREGROUND_SERVICE`
- `READ_PHONE_STATE` (optionnel, si détection automatique du MSISDN via l'opérateur — sinon saisie manuelle)

> **Point d'attention réglementaire** : depuis Android 10+, l'accès à la position en arrière-plan nécessite un consentement explicite et une justification claire affichée à l'utilisateur (Google Play exige une déclaration d'usage). Prévoir un écran de consentement RGPD/protection des données personnelles.

---

## 5. Plateforme Web d'administration (Dashboard)

### 5.1 Fonctionnalités clés

1. **Dashboard principal**
   - Vue d'ensemble : nombre de PDV actifs, nombre de ventes du jour, alertes en cours, taux de couverture géographique.
   - Widgets/KPIs synthétiques avec graphiques (ventes par produit, par zone, par période).

2. **Carte temps réel**
   - Visualisation de tous les PDV sur une carte interactive (Leaflet.js / Google Maps API / Mapbox).
   - Mise à jour en temps réel via WebSocket (Socket.IO) dès qu'une nouvelle position est reçue.
   - Filtres par zone, par commercial, par période.

3. **Historique des déplacements**
   - Replay du parcours d'un PDV sur une période donnée (trajectoire tracée sur la carte).
   - Export de l'historique par PDV.

4. **Gestion du Geofencing**
   - Création de zones géographiques (cercle ou polygone) directement sur la carte.
   - Association d'une ou plusieurs zones à un ou plusieurs PDV.
   - Déclenchement automatique d'une **alerte** (email, notification dashboard, SMS optionnel) dès qu'un PDV sort de sa zone autorisée.
   - Journal des alertes avec statut (traitée / non traitée).

5. **Gestion des enregistrements PDV**
   - Liste, recherche, filtres (produit, concessionnaire, vendeur, date, zone).
   - Fiche détaillée d'un PDV (infos, historique, ventes associées, position actuelle).

6. **Reporting Excel**
   - Génération à la demande (ou planifiée) d'un fichier **Excel professionnel** :
     - Mise en forme avec en-têtes stylés, couleurs, filtres automatiques
     - Feuilles multiples (ex : Ventes, Positions, Alertes, Synthèse)
     - Graphiques intégrés (optionnel)
   - Filtres avant export (période, zone, commercial, produit).

7. **Gestion des utilisateurs et rôles**
   - Rôles : Administrateur, Superviseur, Commercial (lecture seule sur son périmètre).
   - Authentification sécurisée (JWT + refresh token).

### 5.2 Stack technique recommandée (Node.js)

| Couche | Technologie |
|---|---|
| Backend / API REST | Node.js + Express.js (ou NestJS pour une architecture plus structurée) |
| Temps réel | Socket.IO (WebSocket) |
| Base de données | MySQL (via Sequelize ou Prisma ORM) |
| Authentification | JWT + bcrypt pour le hashage des mots de passe |
| Génération Excel | `exceljs` (mise en forme avancée, styles, graphiques) |
| Cartographie | Leaflet.js (open-source) ou Google Maps JavaScript API |
| Frontend Dashboard | React.js (ou Vue.js) + Template admin (ex. base sur **Tabler**, **AdminLTE**, **CoreUI** ou **Mantine Admin**) pour un rendu professionnel et responsive |
| UI Framework | Bootstrap 5 / Tailwind CSS + composants type carte, tableaux, graphiques (Chart.js / ApexCharts) |
| Notifications | Nodemailer (email), Twilio/API opérateur local (SMS, optionnel) |
| Hébergement | VPS/Cloud (ex. AWS EC2, OVH, ou hébergement local) + Nginx en reverse proxy |
| Sécurité transport | HTTPS (certificat SSL/TLS - Let's Encrypt) |

### 5.3 Design du template admin

- Style professionnel, épuré, responsive (adapté mobile, tablette, desktop).
- Palette de couleurs sobre avec code couleur pour les statuts (vert = actif/dans la zone, rouge = alerte/hors zone, orange = en attente).
- Sidebar de navigation, barre de recherche globale, notifications en temps réel (cloche avec badge).
- Composants réutilisables : cartes statistiques, tableaux triables/filtrables, graphiques dynamiques.

---

## 6. Base de données (MySQL) — Modèle conceptuel

### Tables principales

**`users`**
- id, nom, prénom, email, mot_de_passe (hashé), rôle, statut, date_création

**`pdv` (Points de vente)**
- id, nom_pdv, msisdn_responsable, latitude_creation, longitude_creation, date_installation_app, statut, zone_geofence_id (FK)

**`positions`** (historique GPS)
- id, pdv_id (FK), latitude, longitude, précision, horodatage

**`ventes`**
- id, pdv_id (FK), produit, nom_concessionnaire, nom_vendeur, contact_vendeur, latitude_saisie, longitude_saisie, horodatage, statut_sync

**`geofence_zones`**
- id, nom_zone, type (cercle/polygone), coordonnées (JSON/GeoJSON), rayon (si cercle), date_création, créé_par

**`alertes`**
- id, pdv_id (FK), zone_id (FK), type_alerte (sortie_zone), latitude, longitude, horodatage, statut (traitée/non traitée)

**`produits`** (référentiel optionnel)
- id, nom_produit, catégorie, statut

> Recommandation : utiliser l'extension **spatiale de MySQL** (types `POINT`, `POLYGON` avec index `SPATIAL`) pour optimiser les calculs de geofencing (fonction `ST_Contains`, `ST_Distance_Sphere`).

---

## 7. Géofencing — Fonctionnement technique

1. Le superviseur dessine une zone (cercle ou polygone) sur la carte du dashboard et l'associe à un ou plusieurs PDV.
2. La zone est stockée en base sous forme de coordonnées géographiques.
3. À chaque réception d'une nouvelle position GPS d'un PDV (via l'API mobile), le backend Node.js :
   - Récupère la/les zone(s) associée(s) à ce PDV.
   - Calcule si la position est **à l'intérieur ou à l'extérieur** de la zone (`ST_Contains` en MySQL, ou librairie `turf.js` côté Node).
   - Si sortie de zone détectée → création d'une alerte en base + notification en temps réel (WebSocket) + email/SMS optionnel.
4. Le dashboard affiche l'alerte instantanément (badge + notification) et l'historise dans le journal des alertes.

---

## 8. Sécurité et conformité

- Chiffrement des communications (HTTPS/TLS) entre l'app mobile et le backend.
- Authentification par token JWT avec expiration et refresh token.
- Hashage des mots de passe (bcrypt).
- Gestion des rôles et permissions (contrôle d'accès par ressource).
- Consentement explicite de l'utilisateur pour la collecte de la géolocalisation (conformité RGPD / loi locale sur la protection des données personnelles).
- Journalisation (logs) des accès et actions sensibles (audit trail).
- Sauvegardes régulières de la base de données.

---

## 9. Planning de mise en œuvre (proposition)

| Phase | Durée estimée | Livrables |
|---|---|---|
| **Phase 1 — Cadrage & Conception** | 1 à 2 semaines | Spécifications fonctionnelles détaillées, maquettes UI/UX, modèle de données validé |
| **Phase 2 — Développement Backend & Base de données** | 3 à 4 semaines | API REST Node.js, base MySQL, authentification, moteur de geofencing |
| **Phase 3 — Développement Application Mobile Android** | 4 semaines | App Android (onboarding, saisie, GPS, mode hors-ligne) |
| **Phase 4 — Développement Plateforme Web (Dashboard)** | 4 semaines | Dashboard, carte temps réel, gestion des zones, reporting Excel |
| **Phase 5 — Intégration & Tests** | 2 semaines | Tests fonctionnels, tests de charge, corrections de bugs |
| **Phase 6 — Déploiement & Formation** | 1 semaine | Mise en production, formation des utilisateurs, documentation |
| **Total estimé** | **≈ 15 à 17 semaines** | Solution complète opérationnelle |

---

## 10. Livrables du projet

- Application mobile Android (fichier `.apk` / publication Play Store en interne ou privé).
- Plateforme web complète (code source Node.js + dashboard).
- Base de données MySQL structurée avec scripts de migration.
- Documentation technique (API, architecture, déploiement).
- Guide utilisateur (commercial terrain + administrateur).
- Support de présentation du projet (PowerPoint).

---

## 11. Risques et points d'attention

| Risque | Impact | Mitigation |
|---|---|---|
| Restrictions Android sur la géolocalisation en arrière-plan | Suivi temps réel dégradé | Utiliser les API officielles Google, informer l'utilisateur, tester sur plusieurs versions Android |
| Zones sans couverture réseau | Perte temporaire de synchronisation | Mode hors-ligne avec file d'attente locale (Room/SQLite) |
| Consommation batterie excessive | Désinstallation par l'utilisateur | Optimiser la fréquence de géolocalisation (adaptative selon déplacement) |
| Fiabilité du numéro MSISDN saisi manuellement | Doublons ou erreurs d'association | Validation du format + vérification optionnelle par OTP (code SMS) |
| Charge serveur avec de nombreux PDV en temps réel | Latence dashboard | Architecture WebSocket scalable + mise en cache (Redis en option) |

---

## 12. Prochaines étapes

1. Validation de ce document de cadrage par les parties prenantes.
2. Atelier de spécifications détaillées (écrans, règles de gestion précises).
3. Choix définitif des technologies de cartographie (Google Maps API payant vs Leaflet/OpenStreetMap gratuit).
4. Lancement du développement (Phase 1).

---

*Document préparé pour la présentation du projet « Tracking PDV ».*
