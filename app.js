// app.js

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const moment = require('moment');
const nodemailer = require('nodemailer');

const sequelize = require('./config/database');
const models = require('./models'); // index.js => { Magasin, Produit, Livraison, ... }

const app = express();

// Configuration du moteur de vues EJS
app.set('view engine', 'ejs');

// Récupère le port depuis .env ou 3000 par défaut
const PORT = process.env.PORT || 3000;

// Middlewares pour parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/******************************************************
 * 1) Configuration Multer (upload photos/signatures)
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
 * 2) Test DB + sync
 ******************************************************/
sequelize.authenticate()
  .then(() => {
    console.log('Connexion MySQL OK.');
    // force: false pour préserver les tables
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
    const { nom, adresse, email_notification, marge, delai_paiement } = req.body;
    const newMagasin = await models.Magasin.create({ 
      nom, 
      adresse, 
      email_notification,
      marge,
      delai_paiement
    });
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
 * 4) Routes Produits (CRUD minimal - API JSON)
 ******************************************************/
app.post('/produits', async (req, res) => {
  try {
    const { nom, prix_vente, prix_achat } = req.body;
    const newProduit = await models.Produit.create({ nom, prix_vente, prix_achat });
    res.json(newProduit);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur création produit' });
  }
});

app.get('/produits', async (req, res) => {
  try {
    const produits = await models.Produit.findAll();
    res.json(produits);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur récupération produits' });
  }
});

/******************************************************
 * 5) Routes Livraisons (API JSON)
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
    res.status(500).json({ message: 'Erreur création livraison' });
  }
});

/******************************************************
 * 6) Routes Récupérations (API JSON)
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
    res.status(500).json({ message: 'Erreur création récupération' });
  }
});

/******************************************************
 * 7) Route facture PDF (API) - EXEMPLE existant
 *    (Tu peux garder ou remplacer par la nouvelle route)
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
        const prix = parseFloat(ld.Produit.prix_vente) * (1 - magasin.marge/100);
        totalLivraisonHT += prix * parseInt(ld.quantite, 10);
      });
    });

    let totalRecuperationHT = 0;
    recuperations.forEach(rec => {
      rec.RecuperationDetails.forEach(rd => {
        const prix = parseFloat(rd.Produit.prix_vente) * (1 - magasin.marge/100);
        totalRecuperationHT += prix * parseInt(rd.quantite, 10);
      });
    });

    const netHT = totalLivraisonHT - totalRecuperationHT;
    const tvaRate = 0.06;
    const tva = netHT * tvaRate;
    const totalTTC = netHT + tva;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');

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
    doc.text(`Net HT: ${netHT.toFixed(2)} €`);
    doc.text(`TVA (6%): ${tva.toFixed(2)} €`);
    doc.text(`Total TTC: ${totalTTC.toFixed(2)} €`);
    doc.moveDown();

    doc.text(`Coordonnées de paiement:`);
    doc.text(`IBAN: BE00 0000 0000 0000`);
    doc.text(`BIC: XXXX`);
    doc.moveDown();

    doc.text(`Merci de votre confiance!`, { align: 'center' });

    doc.end();
    doc.pipe(res);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur génération facture' });
  }
});

/******************************************************
 * 8) Route pour envoyer la facture par email (API)
 *    (Exemple existant, tu peux réutiliser la nouvelle logique)
 ******************************************************/
app.post('/facture/email', async (req, res) => {
  try {
    const { magasinId, startDate, endDate, emailDest } = req.body;

    // ...exemple original

    // Génération PDF
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
    doc.text(`(Ici, tu peux mettre le détail)`);
    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur email facture' });
  }
});

/******************************************************
 * 9) Route stats (API)
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
 * ========== ROUTES ADMIN (EJS) ==========
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

// POST /admin/produits => nouveau produit
app.post('/admin/produits', async (req, res) => {
  try {
    const { nom, prix_vente, prix_achat } = req.body;
    await models.Produit.create({ nom, prix_vente, prix_achat });
    res.redirect('/admin/produits');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erreur création produit');
  }
});

/******************************************************
 * 10) Nouveau : on installe le router /factures
 ******************************************************/
const factureRoutes = require('./routes/factures');
app.use('/factures', factureRoutes);

/******************************************************
 * Lancement du serveur
 ******************************************************/
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
