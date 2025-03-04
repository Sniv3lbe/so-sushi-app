// app.js

/******************************************************
 * Chargement du .env en local (aucun impact en prod
 * si le fichier .env n'existe pas sur le serveur)
 ******************************************************/
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const moment = require('moment');
const nodemailer = require('nodemailer');

// On importe la config Sequelize (qui lit aussi le .env en local)
const sequelize = require('./config/database');
// On importe tous les modèles (models/index.js)
const models = require('./models'); // Magasin, Produit, Livraison, etc.

const app = express();

// Configuration du moteur de vues EJS
app.set('view engine', 'ejs');

// Récupère le port depuis .env ou, à défaut, 3000
const PORT = process.env.PORT || 3000;

// Middlewares pour parser JSON / urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/******************************************************
 * 1) Configuration Multer (pour l'upload de photos/signatures)
 ******************************************************/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // dossier où stocker les fichiers
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

/******************************************************
 * 2) Test de connexion DB + synchronisation
 ******************************************************/
sequelize.authenticate()
  .then(() => {
    console.log('Connexion MySQL OK.');
    // force: false pour ne pas recréer les tables à chaque démarrage
    return sequelize.sync({ force: false });
  })
  .then(() => {
    console.log('Tables synchronisées !');
  })
  .catch(err => console.error('Erreur sync DB :', err));

/******************************************************
 * ROUTE DE TEST (racine)
 ******************************************************/
app.get('/', (req, res) => {
  res.send('Hello from So Sushi App with Sequelize models!');
});

/******************************************************
 * 3) Routes Magasins (CRUD minimal - version API JSON)
 ******************************************************/
app.post('/magasins', async (req, res) => {
  try {
    const { nom, adresse, email_notification } = req.body;
    const newMagasin = await models.Magasin.create({ nom, adresse, email_notification });
    res.json(newMagasin);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la création du magasin' });
  }
});

app.get('/magasins', async (req, res) => {
  try {
    const magasins = await models.Magasin.findAll();
    res.json(magasins);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la récupération des magasins' });
  }
});

/******************************************************
 * 4) Routes Produits (CRUD minimal - version API JSON)
 ******************************************************/
app.post('/produits', async (req, res) => {
  try {
    const { nom, prix_unitaire } = req.body;
    const newProduit = await models.Produit.create({ nom, prix_unitaire });
    res.json(newProduit);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la création du produit' });
  }
});

app.get('/produits', async (req, res) => {
  try {
    const produits = await models.Produit.findAll();
    res.json(produits);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la récupération des produits' });
  }
});

/******************************************************
 * 5) Route Livraisons (API JSON)
 *    - POST /livraisons => créer une livraison (+ photo)
 ******************************************************/
app.post('/livraisons', upload.single('photo'), async (req, res) => {
  try {
    const {
      magasinId,
      date_livraison,
      responsable_so_sushi,
      responsable_carrefour,
      signature,
      details
    } = req.body;

    let photoPath = null;
    if (req.file) {
      photoPath = req.file.path;
    }

    const newLivraison = await models.Livraison.create({
      magasinId,
      date_livraison,
      responsable_so_sushi,
      responsable_carrefour,
      signature,
      photo: photoPath
    });

    let parsedDetails = [];
    if (details) {
      parsedDetails = JSON.parse(details);
    }

    for (const d of parsedDetails) {
      await models.LivraisonDetail.create({
        livraisonId: newLivraison.id,
        produitId: d.produitId,
        quantite: d.quantite
      });
    }

    res.json({ message: 'Livraison créée avec succès', livraison: newLivraison });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la création de la livraison' });
  }
});

/******************************************************
 * 6) Route Récupérations (API JSON)
 *    - POST /recuperations => créer une récupération (+ photo)
 ******************************************************/
app.post('/recuperations', upload.single('photo'), async (req, res) => {
  try {
    const {
      magasinId,
      date_recuperation,
      responsable_so_sushi,
      responsable_carrefour,
      signature,
      details
    } = req.body;

    let photoPath = null;
    if (req.file) {
      photoPath = req.file.path;
    }

    const newRecup = await models.Recuperation.create({
      magasinId,
      date_recuperation,
      responsable_so_sushi,
      responsable_carrefour,
      signature,
      photo: photoPath
    });

    let parsedDetails = [];
    if (details) {
      parsedDetails = JSON.parse(details);
    }

    for (const d of parsedDetails) {
      await models.RecuperationDetail.create({
        recuperationId: newRecup.id,
        produitId: d.produitId,
        quantite: d.quantite
      });
    }

    res.json({ message: 'Récupération créée avec succès', recuperation: newRecup });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la création de la récupération' });
  }
});

/******************************************************
 * 7) Route facture PDF (API)
 ******************************************************/
app.get('/facture/:magasinId/:startDate/:endDate', async (req, res) => {
  try {
    const { magasinId, startDate, endDate } = req.params;

    const magasin = await models.Magasin.findByPk(magasinId);
    if (!magasin) {
      return res.status(404).json({ message: 'Magasin introuvable' });
    }

    const livraisons = await models.Livraison.findAll({
      where: {
        magasinId,
        date_livraison: {
          [models.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      include: [
        {
          model: models.LivraisonDetail,
          include: [models.Produit]
        }
      ]
    });

    const recuperations = await models.Recuperation.findAll({
      where: {
        magasinId,
        date_recuperation: {
          [models.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      include: [
        {
          model: models.RecuperationDetail,
          include: [models.Produit]
        }
      ]
    });

    let totalLivraisonHT = 0;
    livraisons.forEach(livr => {
      livr.LivraisonDetails.forEach(ld => {
        const prixU = parseFloat(ld.Produit.prix_unitaire);
        const qte = parseInt(ld.quantite, 10);
        totalLivraisonHT += prixU * qte;
      });
    });

    let totalRecuperationHT = 0;
    recuperations.forEach(rec => {
      rec.RecuperationDetails.forEach(rd => {
        const prixU = parseFloat(rd.Produit.prix_unitaire);
        const qte = parseInt(rd.quantite, 10);
        totalRecuperationHT += prixU * qte;
      });
    });

    const netHT = totalLivraisonHT - totalRecuperationHT;
    const tvaRate = 0.06; // 6%
    const tva = netHT * tvaRate;
    const totalTTC = netHT + tva;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    // res.setHeader('Content-Disposition', 'attachment; filename=facture.pdf');

    doc.fontSize(20).text('FACTURE / INVOICE', { align: 'center' });
    doc.moveDown();

    const invoiceNumber = `2025-SSC-${Date.now()}`;
    doc.fontSize(12).text(`Facture N°: ${invoiceNumber}`);
    doc.text(`Date: ${moment().format('YYYY-MM-DD')}`);
    doc.text(`Période: du ${startDate} au ${endDate}`);
    doc.text(`Magasin: ${magasin.nom}`);
    doc.moveDown();

    doc.text(`Total Livraisons HT: ${totalLivraisonHT.toFixed(2)} €`);
    doc.text(`Total Récupérations HT: ${totalRecuperationHT.toFixed(2)} €`);
    doc.text(`Net HT (liv - récup): ${netHT.toFixed(2)} €`);
    doc.text(`TVA (6%): ${tva.toFixed(2)} €`);
    doc.text(`Total TTC: ${totalTTC.toFixed(2)} €`);
    doc.moveDown();

    doc.text(`Coordonnées de paiement:`);
    doc.text(`BANQUE: XXX`);
    doc.text(`IBAN: BE00 0000 0000 0000`);
    doc.text(`BIC: XXXX`);
    doc.moveDown();

    doc.text(`Merci de votre confiance!`, { align: 'center' });

    doc.end();
    doc.pipe(res);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la génération de la facture' });
  }
});

/******************************************************
 * 8) Route pour envoyer la facture par email (API)
 ******************************************************/
app.post('/facture/email', async (req, res) => {
  try {
    const { magasinId, startDate, endDate, emailDest } = req.body;

    const totalLivraisonHT = 100;
    const totalRecuperationHT = 20;
    const netHT = 80;
    const tvaRate = 0.06;
    const tva = netHT * tvaRate;
    const totalTTC = netHT + tva;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    let buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', async () => {
      let pdfData = Buffer.concat(buffers);

      const mailHost = process.env.MAIL_HOST || 'smtp.monserveur.com';
      const mailPort = parseInt(process.env.MAIL_PORT || '587', 10);
      const mailUser = process.env.MAIL_USER || 'monuser@exemple.com';
      const mailPass = process.env.MAIL_PASS || 'secret';

      let transporter = nodemailer.createTransport({
        host: mailHost,
        port: mailPort,
        secure: false,
        auth: {
          user: mailUser,
          pass: mailPass
        }
      });

      let mailOptions = {
        from: '"So Sushi" <noreply@sosushi.be>',
        to: emailDest,
        subject: 'Votre facture So Sushi',
        text: 'Veuillez trouver ci-joint votre facture.',
        attachments: [
          {
            filename: 'facture.pdf',
            content: pdfData,
            contentType: 'application/pdf'
          }
        ]
      };

      let info = await transporter.sendMail(mailOptions);
      console.log('Mail envoyé: ' + info.messageId);
      return res.json({ message: 'Facture envoyée par email avec succès' });
    });

    doc.fontSize(20).text('FACTURE EXAMPLE', { align: 'center' });
    doc.moveDown();
    doc.text(`Total Livraisons HT: ${totalLivraisonHT.toFixed(2)} €`);
    doc.text(`Total Récupérations HT: ${totalRecuperationHT.toFixed(2)} €`);
    doc.text(`Net HT: ${netHT.toFixed(2)} €`);
    doc.text(`TVA (6%): ${tva.toFixed(2)} €`);
    doc.text(`Total TTC: ${totalTTC.toFixed(2)} €`);

    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur email facture' });
  }
});

/******************************************************
 * 9) Route stats (API) : livraisons / récupérations par produit
 ******************************************************/
app.get('/stats/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;

    const livDetails = await models.LivraisonDetail.findAll({
      include: [
        {
          model: models.Livraison,
          where: {
            date_livraison: {
              [models.Sequelize.Op.between]: [startDate, endDate]
            }
          }
        },
        {
          model: models.Produit
        }
      ]
    });

    const recDetails = await models.RecuperationDetail.findAll({
      include: [
        {
          model: models.Recuperation,
          where: {
            date_recuperation: {
              [models.Sequelize.Op.between]: [startDate, endDate]
            }
          }
        },
        {
          model: models.Produit
        }
      ]
    });

    let livraisonsParProduit = {};
    let recuperationsParProduit = {};

    livDetails.forEach(ld => {
      const nomProd = ld.Produit.nom;
      if (!livraisonsParProduit[nomProd]) {
        livraisonsParProduit[nomProd] = 0;
      }
      livraisonsParProduit[nomProd] += ld.quantite;
    });

    recDetails.forEach(rd => {
      const nomProd = rd.Produit.nom;
      if (!recuperationsParProduit[nomProd]) {
        recuperationsParProduit[nomProd] = 0;
      }
      recuperationsParProduit[nomProd] += rd.quantite;
    });

    res.json({
      livraisonsParProduit,
      recuperationsParProduit
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur stats' });
  }
});

/******************************************************
 * ========== ROUTES ADMIN (EJS) POUR PRODUITS ==========
 ******************************************************/
// GET /admin/produits => Liste EJS
app.get('/admin/produits', async (req, res) => {
  try {
    const produits = await models.Produit.findAll();
    res.render('admin/produits', { produits });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erreur chargement produits');
  }
});

// GET /admin/produits/new => Formulaire EJS
app.get('/admin/produits/new', (req, res) => {
  res.render('admin/newProduit');
});

// POST /admin/produits => Crée un nouveau produit, puis redirige
app.post('/admin/produits', async (req, res) => {
  try {
    const { nom, prix_unitaire } = req.body;
    await models.Produit.create({ nom, prix_unitaire });
    res.redirect('/admin/produits');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erreur création produit');
  }
});

/******************************************************
 * ========== (Tu peux créer d'autres routes admin EJS ici) ==========
 ******************************************************/

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
