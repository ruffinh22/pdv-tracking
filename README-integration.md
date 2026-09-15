# Enrôlement PDV depuis le mobile + attributs administrables

Correction complète du flux : le terminal installé au point de vente crée un
dossier **brouillon** (matricule agent + coordonnées GPS + identifiant unique du
terminal), que l'agent commercial **complète ensuite depuis le back-office**.
L'administrateur peut ajouter, modifier ou supprimer les champs de cette fiche.

---

## 1. Le parcours, de bout en bout

1. **Sur le mobile** — l'agent saisit son numéro matricule. L'app vérifie le
   matricule pendant la frappe et affiche le nom de l'agent (ou signale une
   faute de frappe) sans attendre le GPS.
2. **Au clic sur « Se connecter »** — l'app relève la position GPS, récupère
   l'identifiant unique du terminal, et envoie le tout à `/pdv/mobile/enroll`.
3. **Côté serveur** — un PDV est créé en `statut_dossier = 'brouillon'`,
   rattaché à l'agent via son matricule, avec pays/ville/commune/quartier
   pré-remplis par géocodage inverse.
4. **Sur le web** — l'agent ouvre l'onglet « Brouillons » de la liste PDV,
   clique sur le dossier et renseigne nom, vendeur, agence, superviseur,
   produits vendus et tous les champs personnalisés.
5. **Le serveur décide seul** si le dossier bascule en `complet` : dès qu'il ne
   manque plus rien. Un dossier partiel reste enregistré en brouillon, aucune
   saisie n'est perdue.

---

## 2. Installation

### Backend

Copier `backend/src/` sur votre dossier `src/` backend. Fichiers concernés :

| Fichier | État |
|---|---|
| `models/PDV.js` | modifié — `statut_dossier`, `matricule_agent`, `date_completion`, `complete_par` ; `id_terminal` devient l'identité ; `msisdn_responsable` facultatif |
| `models/User.js` | modifié — `matricule` unique |
| `models/index.js` | modifié — associations des attributs |
| `models/PdvAttribut.js` | **nouveau** |
| `models/PdvAttributValeur.js` | **nouveau** |
| `services/pdvAttributService.js` | **nouveau** |
| `services/positionRetentionService.js` | **nouveau** — purge glissante de l'historique |
| `controllers/pdvController.js` | modifié — `mobileEnroll`, `mobileVerifierMatricule`, `completerPDV` |
| `controllers/pdvAttributController.js` | **nouveau** |
| `controllers/userController.js` | modifié — matricule à la création/mise à jour |
| `routes/pdv.js`, `routes/pdvAttribut.js` | modifié / nouveau |
| `server.js` | modifié — montage de `/api/pdv-attributs` |
| `database/migrations/20260915-enrolement-pdv-brouillon.js` | **nouveau** |

La migration s'exécute au démarrage (`runMigrations`). Elle est idempotente et
passe les PDV déjà en base en `complet`, pour qu'ils n'atterrissent pas dans la
file des brouillons.

**Sauvegardez la base avant le premier démarrage** — la migration modifie des
colonnes existantes (`id_terminal`, `msisdn_responsable`).

### Web

Copier `web/src/` sur votre `src/` frontend :

- `pages/PDVDetail.tsx` — remplace le placeholder par le formulaire de complétion
- `pages/PdvAttributs.tsx` — **nouveau**, administration des champs
- `pages/PDVList.tsx` — onglets Tous / Brouillons / Complets, colonne « Dossier », lignes cliquables
- `pages/Users.tsx` — champ matricule
- `services/pdvService.ts`, `services/userService.ts` — types mis à jour
- `services/pdvAttributService.ts` — **nouveau**
- `components/PDVTrackingMap.tsx` — **nouveau**, carte de suivi d'un PDV
- `config/permissions.ts`, `App.tsx` — route et menu « Attributs PDV »

### Mobile

Copier `mobile/src/` :

- `app/onboarding.tsx` — champ matricule avec vérification en direct
- `context/AppContext.tsx` — `register(matricule)` vers `/pdv/mobile/enroll`
- `lib/terminalId.ts` — identifiant matériel stable

Optionnel mais recommandé :

```bash
npx expo install expo-application
```

Sans ce paquet, l'app retombe sur un UUID tiré au sort : parfaitement
fonctionnel, mais un terminal qui réinstalle l'app créera un nouveau dossier au
lieu de retrouver le sien. Avec `expo-application`, l'identifiant survit à la
réinstallation sur Android.

Puis reconstruire l'APK (`eas build -p android`).

---

## 3. Mise en service

1. **Attribuer un matricule à chaque agent** — Paramètres › Utilisateurs.
   Sans matricule, un compte ne peut pas être utilisé sur le terrain. C'est la
   seule étape manuelle obligatoire avant la première tournée.
2. **Définir les champs de la fiche** — Paramètres › Attributs PDV.
   Types disponibles : texte, texte long, nombre, oui/non, date, liste,
   liste multiple, téléphone, email. Chaque champ a une section d'affichage,
   un texte d'aide et un ordre.

---

## 4. Suivi cartographique dans le back-office

Chaque PDV enrôlé remonte sa position en arrière-plan (un point toutes les
30 secondes, stockage local puis synchronisation). La fiche du PDV affiche
désormais une carte de suivi comprenant :

- le **point d'ancrage** — la position relevée à l'installation ;
- le **cercle de géofence** (500 m par défaut) ;
- le **trajet du terminal** sur 24 h, 7 jours ou 30 jours ;
- la **position courante**, en rouge si elle sort de la zone ;
- les chiffres qui répondent à la vraie question d'un superviseur : nombre de
  points, distance parcourue, **éloignement maximal du point de vente**.

La position se met à jour **en direct** via le socket déjà en place — aucun
rafraîchissement manuel. Un rechargement toutes les 2 minutes sert de filet de
sécurité si la connexion temps réel tombe.

### Ce qui a été durci pour que ça tienne dans la durée

**L'historique est borné et échantillonné.** `GET /pdv/:id/positions` renvoyait
l'intégralité des positions, sans limite : au rythme de 2 880 points par jour et
par terminal, la réponse et la carte devenaient inutilisables en quelques
semaines. La route accepte maintenant `?debut=&fin=&limit=` (24 h et 1 000
points par défaut) et échantillonne régulièrement au-delà du plafond — le tracé
garde sa forme, la réponse garde une taille constante. Le dernier point est
toujours conservé, car c'est celui qui compte sur une carte de suivi.

**La table `positions` ne grossit plus indéfiniment.** Une purge quotidienne
supprime les positions au-delà de `POSITIONS_RETENTION_JOURS` (90 par défaut,
`0` désactive). Elle procède par lots de 5 000 lignes : un `DELETE` massif
verrouillerait la table et bloquerait les écritures du tracking en cours.

```env
POSITIONS_RETENTION_JOURS=90
```

**Les dérives GPS sont exclues du calcul de distance.** Un saut de plus de 2 km
entre deux relevés espacés de 30 secondes est un artefact, pas un déplacement :
l'inclure gonflerait artificiellement le kilométrage affiché.

**Le périmètre de données s'applique au suivi comme au reste.** Un commercial ne
voit le trajet que de ses propres PDV, un superviseur ceux de son équipe. Rien
de spécifique n'a été ajouté : les routes de suivi passent par le même contrôle
`peutAccederAuPDV`.

### Un point à trancher côté organisation

Ce suivi trace un **terminal**, pas une personne — mais dans les faits, le
terminal est porté ou tenu par un vendeur, et l'historique permet de
reconstituer ses déplacements. Selon votre juridiction, cela relève du
traitement de données personnelles : information préalable de la personne,
finalité déclarée, et durée de conservation justifiée. Le paramètre
`POSITIONS_RETENTION_JOURS` est là pour aligner la rétention technique sur la
durée que vous aurez retenue. L'écran mobile mentionne déjà l'usage du GPS ;
il est prudent de faire valider cette formulation en interne.

---

## 5. Points de conception

**L'identité du PDV, c'est le terminal.** `/pdv/mobile/enroll` est idempotent
sur `terminal_id` : si l'agent réessaie après une coupure réseau, ou si un
collègue se connecte sur le même appareil, on retombe sur le même dossier au
lieu de créer un doublon. La position est rafraîchie, mais **jamais les
informations déjà saisies depuis le web**.

**Le statut du dossier n'est jamais accepté depuis le client.** Il est
recalculé côté serveur à partir de ce qui est réellement renseigné — champs
fixes *et* attributs obligatoires. Un client ne peut pas marquer « complet » un
dossier qui ne l'est pas, et la réponse de l'API expose
`informations_manquantes` pour que l'interface dise précisément ce qui reste.

**Désactiver plutôt que supprimer un attribut.** Supprimer efface les valeurs
saisies sur tous les PDV. L'API renvoie le nombre d'enregistrements impactés et
l'interface affiche une confirmation explicite, mais le bouton « masquer »
(œil) est l'option à privilégier pour retirer un champ du formulaire sans rien
perdre.

**Le `code` d'un attribut n'est pas modifiable après création.** C'est la clé à
laquelle les valeurs sont rattachées ; le libellé, lui, reste librement
renommable.

**Périmètre de données inchangé.** Un commercial ne voit que ses PDV
(`commercial_id`), ce qui fonctionne naturellement ici puisque l'enrôlement
renseigne ce champ depuis le matricule. Superviseurs, chefs de zone et comptes
agence gardent leurs règles existantes.

**Rétrocompatibilité.** L'ancien `/pdv/mobile/upsert` est conservé et délègue au
nouvel enrôlement quand un matricule est présent. Les APK déjà installés
continuent de fonctionner pendant le déploiement progressif du parc.

---

## 6. Référence API

| Méthode | Route | Auth | Rôle |
|---|---|---|---|
| `POST` | `/api/pdv/mobile/enroll` | non | — |
| `GET` | `/api/pdv/mobile/matricule/:matricule` | non | — |
| `GET` | `/api/pdv?statut_dossier=brouillon` | JWT | tous (selon périmètre) |
| `GET` | `/api/pdv/:id` | JWT | renvoie `attributs_personnalises` + `informations_manquantes` |
| `PUT` | `/api/pdv/:id/completer` | JWT | tous (selon périmètre) |
| `GET` | `/api/pdv/:id/positions?debut=&fin=&limit=` | JWT | historique borné et échantillonné |
| `GET` | `/api/pdv/:id/trajet?debut=&fin=` | JWT | distance parcourue, éloignement max |
| `GET` | `/api/pdv-attributs` | JWT | tous |
| `POST` `PUT` `DELETE` | `/api/pdv-attributs[/:id]` | JWT | admin |
| `PUT` | `/api/pdv-attributs/reorder` | JWT | admin |

### Enrôlement

```json
POST /api/pdv/mobile/enroll
{
  "matricule": "AG00412",
  "terminal_id": "and-9f3a2c1d4b5e6f70",
  "latitude": 6.3702,
  "longitude": 2.3912,
  "device_info": { "platform": "android", "version": "2.0.0" }
}
```

### Complétion

```json
PUT /api/pdv/12/completer
{
  "nom_pdv": "Boutique Étoile",
  "vendeur_nom": "Koffi Aya",
  "agence_id": 3,
  "superviseur_id": 7,
  "produits_ids": [1, 4],
  "attributs": { "type_de_local": "Kiosque", "surface_m2": 18 }
}
```

Réponse : la fiche complète, `statut_dossier` recalculé et
`informations_manquantes` (vide si le dossier est validé).
