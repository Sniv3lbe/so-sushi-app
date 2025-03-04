// models/Recuperation.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Recuperation = sequelize.define('Recuperation', {
  date_recuperation: {
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
  tableName: 'recuperations'
});

module.exports = Recuperation;

