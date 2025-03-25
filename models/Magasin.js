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
    type: DataTypes.DECIMAL(5,2), // ex: 20 => 20%
    defaultValue: 20.00
  },
  delai_paiement: {
    type: DataTypes.INTEGER, // nb de jours
    defaultValue: 30
  }
}, {
  tableName: 'magasins'
});

module.exports = Magasin;
