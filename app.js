// app.js

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit'); // si besoin
const fs = require('fs');
const moment = require('moment');
const nodemailer = require('nodemailer');

const sequelize = require('./config/database');
const models = require('./models'); // { Magasin, Produit, ... }
const { Op } = require('sequelize');

const app = express();

// === 1) Moteur de template EJS ===
app.set('view engine', 'ejs');

// === 2) Port & Parsing ===
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === 3) Statique (Bootstrap, custom CSS, etc.) ===
app.use(express.static('public'));

// === 4) Config Multer (upload) ===
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// === 5) Connexion DB + Sync ===
sequelize.authenticate()
  .then(() => {
    console.log('Connexion MySQL OK.');
    return sequelize.sync({ force: false });
  })
  .then(() => {
    console.log('Tables synchronisées !');
  })
  .catch(err => console.error('Erreur sync DB :', err));

// === 6) Route d'accueil ===
app.get('/', (req, res) => {
  res.send('Hello from So Sushi App with Sequelize models + Dashboard!');
});

// === 7) Routes CRUD Magasins, Produits, etc. ===

// Magasins
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur création magasin' });
  }
});

app.get('/magasins', async (req, res) => {
  try {
    const magasins = await models.Magasin.findAll();
    res.json(magasins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur récupération magasins' });
  }
});

// Produits
app.post('/produits', async (req, res) => {
  try {
    const { nom, prix_vente, prix_achat } = req.body;
    const newProduit = await models.Produit.create({ nom, prix_vente, prix_achat });
    res.json(newProduit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur création produit' });
  }
});

app.get('/produits', async (req, res) => {
  try {
    const produits = await models.Produit.findAll();
    res.json(produits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur récupération produits' });
  }
});

// Livraisons
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur création livraison' });
  }
});

// Récupérations
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur création récupération' });
  }
});

// Stats
app.get('/stats/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;

    const livDetails = await models.LivraisonDetail.findAll({
      include: [
        {
          model: models.Livraison,
          where: {
            date_livraison: {
              [Op.between]: [startDate, endDate]
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
              [Op.between]: [startDate, endDate]
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur stats' });
  }
});

// === 8) Intégration du router Factures ===
const factureRoutes = require('./routes/factures');
app.use('/factures', factureRoutes);

// === 9) Routes Admin (EJS) ===
// a) Dashboard
app.get('/admin/dashboard', async (req, res) => {
  try {
    // Ex: petit résumé du total CA du jour (exemple)
    // -> On peut faire un calcul sur les livraisons d'aujourd'hui
    const today = moment().format('YYYY-MM-DD');

    const todaysLivraisons = await models.Livraison.findAll({
      where: { date_livraison: today },
      include: [
        {
          model: models.LivraisonDetail,
          include: [models.Produit]
        },
        {
          model: models.Magasin
        }
      ]
    });

    let totalHT = 0;
    todaysLivraisons.forEach(liv => {
      liv.LivraisonDetails.forEach(ld => {
        const prixVente = parseFloat(ld.Produit.prix_vente) || 0;
        const marge = liv.Magasin.marge || 20; // fallback
        totalHT += (prixVente * (1 - marge/100)) * ld.quantite;
      });
    });

    res.render('admin/dashboard', {
      totalHT
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur chargement dashboard');
  }
});

// b) Produits (version EJS)
app.get('/admin/produits', async (req, res) => {
  try {
    const produits = await models.Produit.findAll();
    res.render('admin/produits', { produits });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erreur chargement produits');
  }
});

// c) Magasins (version EJS)
app.get('/admin/magasins', async (req, res) => {
  try {
    const magasins = await models.Magasin.findAll();
    res.render('admin/magasins', { magasins });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erreur chargement magasins');
  }
});

// d) Factures (version EJS) - simple listing depuis la table Invoice
app.get('/admin/factures', async (req, res) => {
  try {
    const factures = await models.Invoice.findAll({
      include: [models.Magasin],
      order: [['id', 'DESC']]
    });
    res.render('admin/factures', { factures });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erreur chargement factures');
  }
});

// === 10) Lancement du serveur ===
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
