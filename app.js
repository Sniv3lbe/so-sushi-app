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
const models = require('./models'); // => index.js
const { Op } = require('sequelize');

const app = express();

// Moteur EJS
app.set('view engine', 'ejs');

// PORT
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // pour CSS/JS statique

// Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // dossier
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Connexion DB + Sync
sequelize.authenticate()
  .then(() => {
    console.log('Connexion MySQL OK.');

    // ATTENTION: si tu veux recréer la table produits avec la colonne prix_vente
    // mets force: true ou alter: true. (force: true efface tout, alter: true essaie d'ajuster)
    return sequelize.sync({ force: false });
    // return sequelize.sync({ alter: true });
  })
  .then(() => {
    console.log('Tables synchronisées !');
  })
  .catch(err => console.error('Erreur sync DB :', err));

// ROUTE RACINE
app.get('/', (req, res) => {
  res.send('Hello from So Sushi App with Sequelize models + Dashboard!');
});

// CRUD Magasins
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

// CRUD Produits
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

// EXEMPLE route /admin/dashboard
app.get('/admin/dashboard', async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');

    // On inclut LivraisonDetail + Produit + Magasin
    const todaysLivraisons = await models.Livraison.findAll({
      where: { date_livraison: today },
      include: [
        {
          model: models.LivraisonDetail,
          include: [ models.Produit ]
        },
        {
          model: models.Magasin
        }
      ]
    });

    let totalHT = 0;
    todaysLivraisons.forEach(liv => {
      const marge = liv.Magasin.marge || 20;
      liv.LivraisonDetails.forEach(ld => {
        const prixVente = parseFloat(ld.Produit.prix_vente) || 0;
        const qte = ld.quantite;
        const prixFacture = prixVente * (1 - marge/100);
        totalHT += prixFacture * qte;
      });
    });

    // Si tu as une vue EJS "admin/dashboard.ejs"
    // on y passe totalHT
    res.render('admin/dashboard', { totalHT });
  } catch (err) {
    console.error('Erreur Dashboard:', err);
    res.status(500).send('Erreur chargement dashboard');
  }
});

// Lancement
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
