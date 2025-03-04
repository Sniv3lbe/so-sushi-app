// config/database.js

// Charge le fichier .env en local (pas d'impact en prod si le .env n'existe pas)
require('dotenv').config();

const { Sequelize } = require('sequelize');

// On récupère la variable d'environnement définie par Heroku pour JawsDB/ClearDB
// ex. "JAWSDB_URL" ou "CLEARDB_DATABASE_URL"
const jawsDBUrl = process.env.JAWSDB_URL;

let sequelize;

if (jawsDBUrl) {
  // On est sur Heroku (ou équivalent), on utilise l'URL fournie par l'add-on
  sequelize = new Sequelize(jawsDBUrl, {
    dialect: 'mysql',
    logging: false,
  });
} else {
  // En local, on s'appuie sur des variables d'env (fournies par .env ou le shell)
  const DB_NAME = process.env.DB_NAME;
  const DB_USER = process.env.DB_USER;
  const DB_PASS = process.env.DB_PASS;
  const DB_HOST = process.env.DB_HOST;

  // Sans valeurs par défaut : si elles sont manquantes, la connexion échouera 
  // => c'est volontairement plus strict et plus sûr.
  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
    host: DB_HOST,
    dialect: 'mysql',
    logging: false,
  });
}

module.exports = sequelize;
