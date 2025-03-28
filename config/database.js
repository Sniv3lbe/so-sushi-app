// config/database.js

require('dotenv').config();
const { Sequelize } = require('sequelize');

// Pour Heroku + ClearDB / JawsDB
const jawsDBUrl = process.env.JAWSDB_URL || process.env.CLEARDB_DATABASE_URL;

let sequelize;

if (jawsDBUrl) {
  // En prod Heroku, on prend l'URL
  sequelize = new Sequelize(jawsDBUrl, {
    dialect: 'mysql',
    logging: false
  });
} else {
  // En local
  const DB_NAME = process.env.DB_NAME;
  const DB_USER = process.env.DB_USER;
  const DB_PASS = process.env.DB_PASS;
  const DB_HOST = process.env.DB_HOST;

  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
    host: DB_HOST,
    dialect: 'mysql',
    logging: false
  });
}

module.exports = sequelize;
