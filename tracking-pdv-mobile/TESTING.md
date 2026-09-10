# Guide de Test - Application Mobile Tracking PDV

## 📋 Pré-requis avant de tester

### 1. Configuration du Backend
- ✅ Le backend doit être en cours d'exécution sur `http://localhost:3001`
- ✅ Les routes mobiles doivent être activées dans `backend/src/routes/pdv.js`
- ✅ La base de données doit être initialisée avec le seed

### 2. Configuration de l'IP
- **Important**: L'application mobile utilise l'IP du backend
- Pour trouver votre IP Windows: `ipconfig` → Cherchez "IPv4 Address"
- Pour trouver votre IP Mac/Linux: `ifconfig` → Cherchez "inet"
- Modifiez `config.js` avec votre IP réelle

### 3. Démarrage du Backend
```bash
cd C:\xampp\htdocs\trackingpdv\backend
npm start
```

### 4. Démarrage de l'application mobile
```bash
cd C:\xampp\htdocs\trackingpdv\tracking-pdv-mobile
npm start
```

## 🧪 Scénarios de Test

### Test 1: Onboarding (Premier lancement)

**Objectif**: Vérifier que l'inscription mobile fonctionne

**Étapes**:
1. Installer l'app Expo Go sur votre téléphone Android
2. Scanner le QR code affiché par `npm start`
3. Lancer l'application
4. Accepter les permissions GPS
5. Attendre l'acquisition de la position GPS
6. Saisir un numéro MSISDN (ex: +33612345678)
7. Cliquer sur "Créer mon compte"

**Résultats attendus**:
- ✅ Position GPS affichée avec lat/lng/précision
- ✅ Le compte est créé sur le backend
- ✅ L'utilisateur est redirigé vers l'écran d'accueil
- ✅ Le tracking GPS démarre automatiquement

**Vérification backend**:
```bash
# Vérifier que le PDV a été créé
SELECT * FROM pdv WHERE msisdn_responsable = '+33612345678';
```

### Test 2: Saisie des Ventes (Mode Connecté)

**Objectif**: Vérifier la saisie des ventes avec synchronisation immédiate

**Étapes**:
1. Aller dans l'onglet "Saisie Ventes"
2. Sélectionner un produit
3. Remplir les champs (concessionnaire, vendeur, contact)
4. Vérifier que la position GPS est affichée
5. Cliquer sur "Enregistrer la vente"

**Résultats attendus**:
- ✅ Message de succès "Vente enregistrée avec succès"
- ✅ Le formulaire se réinitialise
- ✅ La vente apparaît dans l'historique avec statut "Synchronisé"
- ✅ La vente est visible dans le backend

**Vérification backend**:
```bash
# Vérifier que la vente a été créée
SELECT * FROM ventes ORDER BY horodatage DESC LIMIT 1;
```

### Test 3: Saisie des Ventes (Mode Hors-ligne)

**Objectif**: Vérifier le mode hors-ligne et la synchronisation différée

**Étapes**:
1. Désactiver le WiFi sur votre téléphone
2. Aller dans l'onglet "Saisie Ventes"
3. Saisir une vente comme dans le Test 2
4. Vérifier que l'enregistrement fonctionne quand même
5. Réactiver le WiFi
6. Cliquer sur le bouton "🔄 Sync"

**Résultats attendus**:
- ✅ La vente est enregistrée localement même hors-ligne
- ✅ Le statut affiche "En attente" dans l'historique
- ✅ Après synchronisation, le statut passe à "Synchronisé"
- ✅ La vente apparaît dans le backend

### Test 4: Tracking GPS en Arrière-plan

**Objectif**: Vérifier que le tracking fonctionne en arrière-plan

**Étapes**:
1. Après l'onboarding, vérifier l'écran d'accueil
2. Vérifier que "Statut du Tracking" affiche "✅ Actif"
3. Quitter l'application (Home button)
4. Attendre 2-3 minutes
5. Rouvrir l'application
6. Cliquer sur "🔄 Sync"

**Résultats attendus**:
- ✅ Le statut de tracking est "Actif"
- ✅ Une notification persistante est visible
- ✅ Des positions ont été enregistrées localement
- ✅ Après synchronisation, les positions sont dans le backend

**Vérification backend**:
```bash
# Vérifier que des positions ont été envoyées
SELECT * FROM positions ORDER BY horodatage DESC LIMIT 10;
```

### Test 5: Historique des Ventes

**Objectif**: Vérifier l'affichage de l'historique avec statuts

**Étapes**:
1. Aller dans l'onglet "Historique"
2. Vérifier que les ventes sont listées
3. Vérifier les statuts (Synchronisé / En attente)
4. Vérifier les dates et heures

**Résultats attendus**:
- ✅ Toutes les ventes sont affichées
- ✅ Les statuts sont corrects
- ✅ Les dates sont au format français
- ✅ Les produits sont clairement identifiables

### Test 6: Synchronisation Manuel

**Objectif**: Vérifier la synchronisation manuelle forcée

**Étapes**:
1. Saisir plusieurs ventes en mode hors-ligne
2. Cliquer sur le bouton "🔄 Sync"
3. Vérifier le message de confirmation
4. Vérifier l'historique

**Résultats attendus**:
- ✅ Message avec le nombre d'éléments synchronisés
- ✅ Tous les statuts passent à "Synchronisé"
- ✅ Le compteur de ventes en attente passe à 0

### Test 7: Déconnexion

**Objectif**: Vérifier que la déconnexion fonctionne correctement

**Étapes**:
1. Cliquer sur "Déconnexion" dans le header
2. Vérifier que l'application retourne à l'écran d'onboarding
3. Réinitialiser l'application
4. Vérifier que les données locales sont conservées

**Résultats attendus**:
- ✅ Retour à l'écran d'onboarding
- ✅ Les données SQLite locales sont conservées
- ✅ L'utilisateur peut se reconnecter avec le même MSISDN

## 🐛 Problèmes Courants et Solutions

### Problème: "Impossible de se connecter au backend"
**Cause**: IP incorrecte ou backend non démarré
**Solution**:
- Vérifiez que le backend tourne sur le port 3001
- Modifiez l'IP dans `config.js`
- Vérifiez que le pare-feu autorise les connexions

### Problème: "GPS ne fonctionne pas"
**Cause**: Permissions non accordées ou GPS désactivé
**Solution**:
- Activez le GPS sur l'appareil
- Accordez les permissions GPS dans les paramètres
- Réinstallez l'application

### Problème: "Le tracking ne fonctionne pas en arrière-plan"
**Cause**: Restrictions Android ou optimisation batterie
**Solution**:
- Désactivez "Optimiser l'utilisation de la batterie" pour l'app
- Vérifiez que l'app est dans la liste des apps exemptées
- Sur certains appareils, ajoutez l'app aux apps autorisées

### Problème: "La synchronisation ne fonctionne pas"
**Cause**: Connexion internet ou problème de configuration
**Solution**:
- Vérifiez la connexion internet
- Vérifiez l'URL du backend dans `config.js`
- Regardez les logs dans la console

## 📊 Checklist de Validation

- [ ] Onboarding fonctionne avec GPS
- [ ] Création de PDV sur le backend
- [ ] Saisie des ventes fonctionne
- [ ] Position GPS automatique lors de la saisie
- [ ] Mode hors-ligne fonctionne
- [ ] Synchronisation automatique fonctionne
- [ ] Synchronisation manuelle fonctionne
- [ ] Tracking GPS en arrière-plan fonctionne
- [ ] Historique des ventes s'affiche correctement
- [ ] Statuts de synchronisation sont corrects
- [ ] Déconnexion fonctionne
- [ ] L'application est stable

## 🎯 Critères de Succès

L'application est considérée comme fonctionnelle si:
1. ✅ L'onboarding fonctionne parfaitement
2. ✅ Les ventes peuvent être saisies en ligne et hors-ligne
3. ✅ La synchronisation fonctionne automatiquement et manuellement
4. ✅ Le tracking GPS fonctionne en arrière-plan
5. ✅ L'historique affiche correctement les données
6. ✅ L'application est stable et ne crash pas

## 📝 Notes de Test

Date: ___________
Testeur: ___________
Version Android: ___________
Version de l'app: ___________

Résultats:
- Test 1: ___________
- Test 2: ___________
- Test 3: ___________
- Test 4: ___________
- Test 5: ___________
- Test 6: ___________
- Test 7: ___________

Commentaires: ___________