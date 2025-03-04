// models/RecuperationDetail.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RecuperationDetail = sequelize.define('RecuperationDetail', {
  quantite: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'recuperations_details'
});

module.exports = RecuperationDetail;

