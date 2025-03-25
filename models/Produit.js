// models/Produit.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Produit = sequelize.define('Produit', {
  nom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Ex: prix "public" (celui que tu affiches sur les étiquettes)
  prix_vente: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  // Si besoin, ton coût d’achat
  prix_achat: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  }
}, {
  tableName: 'produits'
});

module.exports = Produit;
