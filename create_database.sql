-- Script de création de la base de données et de l'utilisateur
-- Exécuter ce script dans MySQL ou phpMyAdmin

-- Créer la base de données
CREATE DATABASE IF NOT EXISTS pdv_tracking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Créer l'utilisateur (si vous n'utilisez pas root)
CREATE USER IF NOT EXISTS 'pdv_app'@'localhost' IDENTIFIED BY 'Janvier@22';

-- Donner tous les privilèges
GRANT ALL PRIVILEGES ON pdv_tracking.* TO 'pdv_app'@'localhost';

-- Appliquer les changements
FLUSH PRIVILEGES;
