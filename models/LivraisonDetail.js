// models/LivraisonDetail.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LivraisonDetail = sequelize.define('LivraisonDetail', {
  quantite: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'livraisons_details'
});

module.exports = LivraisonDetail;
