// models/Livraison.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Livraison = sequelize.define('Livraison', {
  date_livraison: {
    type: DataTypes.DATE,
    allowNull: false
  },
  responsable_so_sushi: {
    type: DataTypes.STRING
  },
  responsable_carrefour: {
    type: DataTypes.STRING
  },
  signature: {
    type: DataTypes.TEXT
  },
  photo: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'livraisons'
});

module.exports = Livraison;
