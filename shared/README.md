# Shared

Ce dossier contient les types et interfaces communs partagés entre le backend, le frontend et l'application mobile.

## Contenu

- `types.ts` - Types TypeScript communs pour tous les projets

## Utilisation

### Dans le frontend (TypeScript)

```typescript
import { PDV, Vente, Position } from '../../shared/types';
```

### Dans le backend (JavaScript)

Les types peuvent être utilisés comme documentation ou convertis en interfaces TypeScript si nécessaire.

### Dans le mobile (Kotlin)

Les types peuvent servir de référence pour les modèles de données Kotlin.

## Types disponibles

- `User` - Utilisateur du système
- `PDV` - Point de Vente
- `Position` - Position GPS
- `Vente` - Enregistrement de vente
- `GeofenceZone` - Zone de géo-clôture
- `Alerte` - Alerte système
- `Produit` - Produit du catalogue
- `ApiResponse` - Réponse API standard
- `LoginRequest` / `LoginResponse` - Authentification
- `KPIs` - Indicateurs clés du dashboard
- `SocketEvent` - Événements WebSocket
