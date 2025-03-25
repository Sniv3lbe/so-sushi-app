// models/index.js

const Magasin = require('./Magasin');
const Produit = require('./Produit');
const Livraison = require('./Livraison');
const LivraisonDetail = require('./LivraisonDetail');
const Recuperation = require('./Recuperation');
const RecuperationDetail = require('./RecuperationDetail');
const Invoice = require('./Invoice');

// --- Associations pour Livraisons ---
Livraison.belongsTo(Magasin, { foreignKey: 'magasinId' });
// Important : relation "inverse" pour inclure LivraisonDetail via Livraison
Livraison.hasMany(LivraisonDetail, { foreignKey: 'livraisonId' });

LivraisonDetail.belongsTo(Livraison, { foreignKey: 'livraisonId' });
LivraisonDetail.belongsTo(Produit, { foreignKey: 'produitId' });

// --- Associations pour Récupérations ---
Recuperation.belongsTo(Magasin, { foreignKey: 'magasinId' });
// Idem : relation "inverse" pour inclure RecuperationDetail via Recuperation
Recuperation.hasMany(RecuperationDetail, { foreignKey: 'recuperationId' });

RecuperationDetail.belongsTo(Recuperation, { foreignKey: 'recuperationId' });
RecuperationDetail.belongsTo(Produit, { foreignKey: 'produitId' });

// --- Association Facture -> Magasin ---
Invoice.belongsTo(Magasin, { foreignKey: 'magasinId' });

// On exporte l'ensemble des modèles pour qu'ils puissent être importés
module.exports = {
  Magasin,
  Produit,
  Livraison,
  LivraisonDetail,
  Recuperation,
  RecuperationDetail,
  Invoice
};
