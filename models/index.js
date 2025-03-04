// models/index.js
const Magasin = require('./Magasin');
const Produit = require('./Produit');
const Livraison = require('./Livraison');
const LivraisonDetail = require('./LivraisonDetail');
const Recuperation = require('./Recuperation');
const RecuperationDetail = require('./RecuperationDetail');

// Associations
Livraison.belongsTo(Magasin, { foreignKey: 'magasinId' });
LivraisonDetail.belongsTo(Livraison, { foreignKey: 'livraisonId' });
LivraisonDetail.belongsTo(Produit, { foreignKey: 'produitId' });

Recuperation.belongsTo(Magasin, { foreignKey: 'magasinId' });
RecuperationDetail.belongsTo(Recuperation, { foreignKey: 'recuperationId' });
RecuperationDetail.belongsTo(Produit, { foreignKey: 'produitId' });

module.exports = {
  Magasin,
  Produit,
  Livraison,
  LivraisonDetail,
  Recuperation,
  RecuperationDetail
};

