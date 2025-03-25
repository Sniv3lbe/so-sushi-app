// models/Produit.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Produit = sequelize.define('Produit', {
  nom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  prix_vente: {
    // La colonne qui doit exister en base
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  prix_achat: {
    // Optionnel, si tu en as besoin
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  }
}, {
  tableName: 'produits'
});

module.exports = Produit;
