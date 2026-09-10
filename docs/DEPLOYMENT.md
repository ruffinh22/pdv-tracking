# Guide de Déploiement

Ce guide explique comment déployer le projet Tracking PDV en production.

## 📋 Prérequis

- Serveur avec accès SSH
- Domaine configuré
- Certificat SSL (Let's Encrypt recommandé)
- MySQL 8.0+
- Node.js 18+
- Nginx (reverse proxy)
- PM2 (process manager)

## 🗄️ Configuration de la base de données

### Création de la base de données

```sql
CREATE DATABASE tracking_pdv CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'trackingpdv'@'localhost' IDENTIFIED BY 'mot_de_passe_securise';
GRANT ALL PRIVILEGES ON tracking_pdv.* TO 'trackingpdv'@'localhost';
FLUSH PRIVILEGES;
```

### Migration des tables

Le backend créera automatiquement les tables au premier démarrage si `sequelize.sync()` est configuré.

## 🚀 Déploiement du Backend

### Installation

```bash
# Copier les fichiers sur le serveur
scp -r backend/ user@server:/var/www/trackingpdv/backend

# SSH sur le serveur
ssh user@server
cd /var/www/trackingpdv/backend

# Installer les dépendances
npm install --production

# Configurer les variables d'environnement
cp .env.example .env
nano .env
```

### Configuration .env

```bash
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_NAME=tracking_pdv
DB_USER=trackingpdv
DB_PASSWORD=votre_mot_de_passe
JWT_SECRET=votre_secret_jwt_tres_long
# ... autres configurations
```

### Démarrage avec PM2

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer l'application
pm2 start src/server.js --name tracking-pdv-backend

# Configurer pour démarrage au boot
pm2 startup
pm2 save
```

## 🌐 Déploiement du Frontend

### Build

```bash
# Sur votre machine locale
cd frontend
npm run build

# Le dossier dist/ sera créé
```

### Upload sur le serveur

```bash
# Copier le build
scp -r dist/ user@server:/var/www/trackingpdv/frontend

# Sur le serveur
cd /var/www/trackingpdv/frontend
# Les fichiers sont maintenant dans le dossier dist/
```

## 📱 Déploiement du Mobile

### Build APK Release

```bash
cd mobile
./gradlew assembleRelease

# L'APK sera dans app/build/outputs/apk/release/
```

### Distribution

- Via email ou lien de téléchargement
- Via Google Play Store (recommandé pour production)
- Via système MDM pour les entreprises

## 🔧 Configuration Nginx

### Créer le fichier de configuration

```bash
sudo nano /etc/nginx/sites-available/trackingpdv
```

### Contenu du fichier

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    # Redirection HTTP vers HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.com;

    # Certificat SSL
    ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;

    # Configuration SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend
    location / {
        root /var/www/trackingpdv/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/trackingpdv /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 Sécurité

### Certificat SSL avec Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

### Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Mises à jour régulières

```bash
sudo apt update && sudo apt upgrade
npm update
```

## 📊 Monitoring

### Logs Backend

```bash
pm2 logs tracking-pdv-backend
```

### Logs Nginx

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Surveillance du serveur

- Utiliser des outils comme UptimeRobot ou Pingdom
- Configurer des alertes email
- Surveiller l'utilisation CPU/mémoire

## 🔄 Mises à jour

### Backend

```bash
cd /var/www/trackingpdv/backend
git pull
npm install --production
pm2 restart tracking-pdv-backend
```

### Frontend

```bash
# Sur votre machine locale
cd frontend
npm run build
scp -r dist/* user@server:/var/www/trackingpdv/frontend/dist/
```

### Mobile

- Publier une nouvelle version sur le Play Store
- Utiliser une solution de MDM pour déploiement automatique

## 🚨 Sauvegardes

### Base de données

```bash
# Script de sauvegarde
mysqldump -u trackingpdv -p tracking_pdv > backup_$(date +%Y%m%d).sql

# Automatiser avec cron
0 2 * * * mysqldump -u trackingpdv -p'MOT_DE_PASSE' tracking_pdv > /backups/trackingpdv_$(date +\%Y\%m\%d).sql
```

### Fichiers

```bash
# Sauvegarder les fichiers importants
rsync -avz /var/www/trackingpdv/ /backup/trackingpdv/
```

## 📞 Support

En cas de problème, contacter l'équipe de support technique.
