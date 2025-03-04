// models/Magasin.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Magasin = sequelize.define('Magasin', {
  nom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  adresse: {
    type: DataTypes.STRING
  },
  email_notification: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'magasins', // pour que Sequelize utilise "magasins" comme nom de table
});

module.exports = Magasin;

