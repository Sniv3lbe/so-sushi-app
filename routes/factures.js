// routes/factures.js
const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const moment = require('moment');
const { Op } = require('sequelize');
const models = require('../models');

// POST /factures/create
router.post('/create', async (req, res) => {
  try {
    const {
      magasinId,
      deliveryStart,
      deliveryEnd,
      recovStart,
      recovEnd,
      invoiceNumber,
      dateFacture // ex: "2025-03-24"
    } = req.body;

    // 1) Récup du magasin
    const magasin = await models.Magasin.findByPk(magasinId);
    if (!magasin) {
      return res.status(404).json({ message: 'Magasin introuvable' });
    }

    // Parse les dates
    const dateFactureObj = moment(dateFacture, 'YYYY-MM-DD');
    const dateEcheanceObj = moment(dateFactureObj).add(magasin.delai_paiement, 'days');

    // 2) Récupérer toutes les livraisons sur [deliveryStart, deliveryEnd]
    const livraisons = await models.Livraison.findAll({
      where: {
        magasinId,
        date_livraison: {
          [Op.between]: [deliveryStart, deliveryEnd]
        }
      },
      include: [
        {
          model: models.LivraisonDetail,
          include: [models.Produit]
        }
      ]
    });

    // 3) Récupérer toutes les récupérations sur [recovStart, recovEnd]
    const recuperations = await models.Recuperation.findAll({
      where: {
        magasinId,
        date_recuperation: {
          [Op.between]: [recovStart, recovEnd]
        }
      },
      include: [
        {
          model: models.RecuperationDetail,
          include: [models.Produit]
        }
      ]
    });

    // 4) Calcul du total HT (simplifié)
    let totalLivraisonHT = 0;
    livraisons.forEach(livr => {
      livr.LivraisonDetails.forEach(ld => {
        const prixVente = parseFloat(ld.Produit.prix_vente);
        const qte = parseInt(ld.quantite, 10);
        // Applique la marge du magasin => ex: s'il a 20% de marge,
        // tu factures 80% du prix_vente
        const prixFacture = prixVente * (1 - magasin.marge / 100);
        totalLivraisonHT += (prixFacture * qte);
      });
    });

    // Idem pour les récupérations (si c'est un avoir à déduire)
    let totalRecupHT = 0;
    recuperations.forEach(rec => {
      rec.RecuperationDetails.forEach(rd => {
        const prixVente = parseFloat(rd.Produit.prix_vente);
        const qte = parseInt(rd.quantite, 10);
        // Même calcul, puis on l'enlève
        const prixFacture = prixVente * (1 - magasin.marge / 100);
        totalRecupHT += (prixFacture * qte);
      });
    });

    // Net HT
    const netHT = totalLivraisonHT - totalRecupHT;

    // 5) Application de la TVA
    const tvaRate = 0.06; // 6%
    const totalTVA = netHT * tvaRate;
    const totalTTC = netHT + totalTVA;

    // 6) On enregistre en base la nouvelle facture
    const newInvoice = await models.Invoice.create({
      magasinId,           // association
      invoiceNumber,       // ex: "2025-SSK-043"
      dateFacture,         // ex: "2025-03-24"
      dateEcheance: dateEcheanceObj.format('YYYY-MM-DD'),
      totalHT: netHT.toFixed(2),
      totalTVA: totalTVA.toFixed(2),
      totalTTC: totalTTC.toFixed(2)
    });

    // 7) Génération PDF via PDFKit
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    let buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);

      // On renvoie directement le PDF
      res.setHeader('Content-Type', 'application/pdf');
      // si on veut le télécharger : 
      // res.setHeader('Content-Disposition', `attachment; filename=${invoiceNumber}.pdf`);
      return res.send(pdfData);
    });

    // Contenu du PDF (à peaufiner selon le style exact que tu veux)
    doc.fontSize(20).text('FACTURE / FACTUUR', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Facture N°: ${invoiceNumber}`);
    doc.text(`Date facture: ${dateFacture}`);
    doc.text(`Echéance: ${dateEcheanceObj.format('YYYY-MM-DD')}`);
    doc.text(`Magasin: ${magasin.nom}`);
    doc.text(`Marge: ${magasin.marge}%`);
    doc.moveDown();

    doc.text(`Période livraisons: du ${deliveryStart} au ${deliveryEnd}`);
    doc.text(`Période récupérations: du ${recovStart} au ${recovEnd}`);
    doc.moveDown();

    doc.text(`Total Livraisons HT: ${totalLivraisonHT.toFixed(2)} €`);
    doc.text(`Total Récupérations HT: ${totalRecupHT.toFixed(2)} €`);
    doc.text(`Net HT: ${netHT.toFixed(2)} €`);
    doc.text(`TVA (6%): ${totalTVA.toFixed(2)} €`);
    doc.text(`Total TTC: ${totalTTC.toFixed(2)} €`);

    doc.moveDown();
    doc.text('Coordonnées bancaires:');
    doc.text('IBAN: BE17 3632 2465 0121');
    doc.text(`Merci de mentionner la référence: ${invoiceNumber}`);
    doc.moveDown();

    doc.text('Merci pour votre confiance!', { align: 'center' });
    doc.end();

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur lors de la création de la facture' });
  }
});

module.exports = router;

