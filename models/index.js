// models/index.js

const Magasin = require('./Magasin');
const Produit = require('./Produit');
const Livraison = require('./Livraison');
const LivraisonDetail = require('./LivraisonDetail');
const Recuperation = require('./Recuperation');
const RecuperationDetail = require('./RecuperationDetail');
const Invoice = require('./Invoice');

// --- Associations Livraisons ---
Livraison.belongsTo(Magasin, { foreignKey: 'magasinId' });

// Indispensable pour pouvoir faire include { model: LivraisonDetail } depuis Livraison
Livraison.hasMany(LivraisonDetail, { foreignKey: 'livraisonId' });

LivraisonDetail.belongsTo(Livraison, { foreignKey: 'livraisonId' });
LivraisonDetail.belongsTo(Produit, { foreignKey: 'produitId' });

// --- Associations Récupérations ---
Recuperation.belongsTo(Magasin, { foreignKey: 'magasinId' });

Recuperation.hasMany(RecuperationDetail, { foreignKey: 'recuperationId' });

RecuperationDetail.belongsTo(Recuperation, { foreignKey: 'recuperationId' });
RecuperationDetail.belongsTo(Produit, { foreignKey: 'produitId' });

// --- Association Facture -> Magasin ---
Invoice.belongsTo(Magasin, { foreignKey: 'magasinId' });

module.exports = {
  Magasin,
  Produit,
  Livraison,
  LivraisonDetail,
  Recuperation,
  RecuperationDetail,
  Invoice
};
