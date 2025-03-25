// models/index.js
const Magasin = require('./Magasin');
const Produit = require('./Produit');
const Livraison = require('./Livraison');
const LivraisonDetail = require('./LivraisonDetail');
const Recuperation = require('./Recuperation');
const RecuperationDetail = require('./RecuperationDetail');
const Invoice = require('./Invoice');

// Associations Livraisons
Livraison.belongsTo(Magasin, { foreignKey: 'magasinId' });
LivraisonDetail.belongsTo(Livraison, { foreignKey: 'livraisonId' });
LivraisonDetail.belongsTo(Produit, { foreignKey: 'produitId' });

// Associations Récupérations
Recuperation.belongsTo(Magasin, { foreignKey: 'magasinId' });
RecuperationDetail.belongsTo(Recuperation, { foreignKey: 'recuperationId' });
RecuperationDetail.belongsTo(Produit, { foreignKey: 'produitId' });

// Association Factures
Invoice.belongsTo(Magasin, { foreignKey: 'magasinId' });
// => un Invoice aura invoice.magasinId
//    permet de savoir pour quel magasin la facture est émise

module.exports = {
  Magasin,
  Produit,
  Livraison,
  LivraisonDetail,
  Recuperation,
  RecuperationDetail,
  Invoice
};
