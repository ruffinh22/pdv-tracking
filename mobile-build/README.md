# Tracking PDV — Application mobile (React Native / Expo)

Application terrain pour la géolocalisation et le suivi des Points de Vente (PDV), conforme au
document de cadrage du projet **Tracking PDV**.

## ✨ Ce qui a été refait dans cette version

- **Architecture propre** : plus de code dupliqué entre `App.tsx` et `src/app/`, plus de fichiers
  de démo Expo (Explore, tutoriels, etc.). Un seul flux : `onboarding` → `(tabs)`.
- **Design aligné sur le dashboard web** : mêmes couleurs (`primary` violet #5641D6/#6D5CE3,
  `ink` gris, `success`/`danger`/`warning`), mêmes rayons de bordure, mêmes ombres douces que
  `frontend/tailwind.config.js`. Voir `src/theme/colors.ts` et `src/theme/typography.ts`.
- **4 écrans (onglets)** :
  - **Accueil** : statut du suivi GPS, KPI du jour (ventes, en attente de sync, total, rayon
    d'alerte 500 m), carte de position avec distance au point de tagging initial.
  - **Ventes** : saisie terrain avec **sélection multiple de produits** (un PDV peut vendre
    plusieurs produits — cf. point 7 du cadrage), position GPS automatique, mode hors-ligne.
  - **Historique** : liste des ventes locales avec statut synchronisé / en attente.
  - **Profil** : identifiant PDV, statut du suivi, synchronisation manuelle, rappel RGPD,
    déconnexion.
- **Onboarding** : capture GPS + saisie MSISDN + écran de **consentement RGPD explicite**
  (obligatoire avant activation du suivi en arrière-plan, conformément au point d'attention
  réglementaire du cadrage).
- **Mode hors-ligne robuste** : file d'attente locale SQLite (`src/lib/database.ts`), synchronisation
  automatique dès que la connexion revient (`src/services/syncService.ts`).
- **Suivi position en tâche de fond** : `src/tasks/locationTask.ts` (foreground service Android,
  notification persistante, remontée périodique conforme au cadrage §4.1.3).
- **Repère de zone 500 m** : `src/lib/geo.ts` calcule la distance réelle par rapport au point de
  tagging initial et l'affiche (alerte visuelle si dépassement), en miroir du moteur de
  geofencing du backend.

## 🚀 Démarrage

Le projet est configuré pour **Yarn** (le `yarn.lock` est fourni, `packageManager` fixé dans `package.json`).

```bash
yarn install
yarn start
```

Puis appuyez sur `a` (Android), `i` (iOS) ou `w` (web) selon votre environnement de test.

## 📦 Générer un APK (debug et release) avec EAS Build

Aucun besoin d'Android Studio : EAS compile dans le cloud.

```bash
npm install -g eas-cli   # ou: yarn global add eas-cli
eas login                # crée/relie un compte gratuit sur expo.dev
eas build:configure      # déjà fait dans ce repo (voir eas.json), à relancer si besoin

# APK de test (debug/preview) — installable directement, pas besoin du Play Store
eas build --platform android --profile preview

# APK de production (release) — signé avec la clé gérée par EAS
eas build --platform android --profile production
```

Le lien de téléchargement du `.apk` (+ QR code) s'affiche à la fin du build (10-20 min), et reste
disponible sur `expo.dev/accounts/<votre-compte>/builds`.

Alternative 100% locale (si Android Studio + SDK déjà installés) :

```bash
yarn expo run:android          # build debug local
cd android && ./gradlew assembleRelease   # build release local (.apk dans android/app/build/outputs/apk/release)
```

## ⚙️ Configuration

Modifiez `src/config.ts` :

```ts
API_BASE_URL: 'http://IP_LAN_DU_PC:3001/api'
```

En développement, utilisez l'IP locale de votre machine (pas `localhost`) pour que le téléphone/
émulateur puisse atteindre le backend Node.js.
## Configuration

### Développement local

Copiez `.env.example` vers `.env.local` et remplacez l'IP par l'adresse LAN
de la machine qui exécute le backend :

```bash
cp .env.example .env.local
# EXPO_PUBLIC_API_URL=http://IP_LAN_DU_PC:3001/api
yarn start
```

Sur un vrai téléphone, `localhost` désigne le téléphone lui-même. Il faut donc une IP
joignable sur le réseau local pour le développement, ou le domaine HTTPS public.

### Production sur EAS

L'API de production est `https://pdvtrack.afrochicluxe.com/api`. Définissez
`EXPO_PUBLIC_API_URL` dans l'environnement EAS `production` :

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://pdvtrack.afrochicluxe.com/api --environment production --visibility plaintext
eas env:list --environment production
eas build --platform android --profile production
```

Une URL d'API n'est pas un secret ; ne placez jamais de mot de passe ou de clé privée
dans une variable `EXPO_PUBLIC_*`. Cette variable est intégrée au binaire au moment du
build : après un changement d'URL, il faut générer et distribuer un nouvel APK.

## 📁 Structure

```
src/
  app/                 → écrans (expo-router)
    onboarding.tsx
    (tabs)/
      index.tsx        → Accueil
      ventes.tsx        → Saisie ventes
      historique.tsx    → Historique
      profil.tsx         → Profil / déconnexion
  components/          → composants UI réutilisables + composants métier
  context/             → état global (AppContext)
  lib/                 → database, api, geo
  services/            → syncService (offline-first)
  tasks/                → tâche de localisation en arrière-plan
  theme/                → couleurs / typographie (alignées sur le web)
  types/                → types partagés
```

## 🔜 Prochaines étapes suggérées

- Ajouter les écrans manquants si besoin (ex. notifications d'alerte reçues côté mobile).
- Générer un build Android signé (`eas build -p android`) pour distribution interne / Play Store privé.
- Brancher Firebase Cloud Messaging si des notifications push sont souhaitées (optionnel, cf. cadrage §4.2).
