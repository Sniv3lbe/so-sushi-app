// models/Produit.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Produit = sequelize.define('Produit', {
  nom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  prix_vente: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  // Optionnellement, si tu veux un prix d'achat (coût)
  prix_achat: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  }
}, {
  tableName: 'produits'
});

module.exports = Produit;
