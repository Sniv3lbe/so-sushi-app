// models/Invoice.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dateFacture: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  dateEcheance: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  totalHT: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },
  totalTVA: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },
  totalTTC: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  }
}, {
  tableName: 'invoices'
});

module.exports = Invoice;
