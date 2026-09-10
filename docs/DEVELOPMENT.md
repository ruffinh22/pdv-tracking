# Guide de Développement

Ce guide fournit les informations nécessaires pour contribuer au développement du projet Tracking PDV.

## 🛠 Configuration de l'environnement de développement

### Prérequis

- Node.js 18+ et npm 9+
- MySQL 8.0+
- Android Studio (pour le développement mobile)
- Git
- Un éditeur de code (VS Code recommandé)

### Installation

1. Cloner le repository :
```bash
git clone <repository-url>
cd trackingpdv
```

2. Installer les dépendances du backend :
```bash
cd backend
npm install
cp .env.example .env
# Configurer .env avec vos paramètres
```

3. Installer les dépendances du frontend :
```bash
cd ../frontend
npm install
```

4. Configurer le projet mobile (Android Studio) :
```bash
cd ../mobile
# Ouvrir le projet dans Android Studio
```

## 🏗️ Structure du projet

Voir le fichier [README.md](../README.md) pour la structure détaillée du projet.

## 🔄 Workflow de développement

### Backend

```bash
cd backend
npm run dev  # Lancer le serveur en mode développement
npm test     # Exécuter les tests
npm run lint # Vérifier le code
```

### Frontend

```bash
cd frontend
npm run dev  # Lancer le serveur de développement
npm run build # Build pour production
npm run lint # Vérifier le code
```

### Mobile

```bash
cd mobile
./gradlew assembleDebug    # Build debug
./gradlew assembleRelease  # Build release
./gradlew test             # Exécuter les tests
```

## 📝 Conventions de code

### JavaScript/TypeScript

- Utiliser ES6+ et TypeScript
- Suivre les règles ESLint configurées
- Utiliser Prettier pour le formatage
- Commenter le code complexe

### Kotlin

- Suivre les conventions Kotlin officielles
- Utiliser les coroutines pour les opérations asynchrones
- Immutabilité quand possible

### Git

- Branches feature : `feature/nom-de-la-fonctionnalite`
- Branches bugfix : `bugfix/nom-du-bug`
- Messages de commit : type(scope): description
  - feat: nouvelle fonctionnalité
  - fix: correction de bug
  - docs: documentation
  - style: formatage
  - refactor: refactoring
  - test: tests
  - chore: maintenance

## 🧪 Tests

### Backend

Les tests sont situés dans `backend/tests/`.

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
npm test
```

### Mobile

```bash
cd mobile
./gradlew test
```

## 🚀 Déploiement

Voir [DEPLOYMENT.md](DEPLOYMENT.md) pour les instructions de déploiement.

## 🐛 Debugging

### Backend

- Logs dans `backend/logs/`
- Utiliser `console.log` pour le développement
- Utiliser Winston pour la production

### Frontend

- React DevTools
- Console du navigateur
- Network tab pour les requêtes API

### Mobile

- Android Studio Logcat
- Debug breakpoints
- Timber pour les logs

## 📚 Ressources

- [Documentation Node.js](https://nodejs.org/docs/)
- [Documentation React](https://react.dev/)
- [Documentation Android](https://developer.android.com/docs)
- [Documentation MySQL](https://dev.mysql.com/doc/)

## 🤝 Contribution

1. Fork le projet
2. Créer une branche
3. Faire les modifications
4. Tester
5. Commit
6. Push
7. Pull Request

## 📞 Support

Pour toute question, contacter l'équipe de développement.
