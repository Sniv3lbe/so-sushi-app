// config/database.js
const { Sequelize } = require('sequelize');

// Paramètres de connexion
const DB_NAME = 'so_sushi_db';
const DB_USER = 'root';       // Utilisateur root
const DB_PASS = 'jimver123';  // Mot de passe
const DB_HOST = 'localhost';  // Hôte MySQL local ou autre

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  dialect: 'mysql',
  logging: false, // pour éviter trop de logs
});

module.exports = sequelize;

