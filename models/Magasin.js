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
  },
  marge: {
    type: DataTypes.DECIMAL(5,2), // ex: 20.00 = 20%
    defaultValue: 20.00
  },
  delai_paiement: {
    type: DataTypes.INTEGER, // en jours
    defaultValue: 30
  }
}, {
  tableName: 'magasins', // nom de table
});

module.exports = Magasin;
