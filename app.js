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
const models = require('./models');
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
    cb(null, 'uploads/'); 
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
    // force: true supprime et recrée toutes les tables
    return sequelize.sync({ force: true });
  })
  .then(() => {
    console.log('Tables synchronisées (force: true) !');
  })
  .catch(err => console.error('Erreur sync DB :', err));

// ROUTE RACINE
app.get('/', (req, res) => {
  res.send('Hello from So Sushi App with Sequelize models + Dashboard!');
});

/* =========================
   ========== API JSON ======
   ========================= 
   (Tu les conserves si tu veux) 
*/

// CRUD Magasins (JSON)
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

// CRUD Produits (JSON)
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

// Livraisons (JSON)
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

// Récupérations (JSON)
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

/* ==============================
   ========== ADMIN EJS =========
   ==============================
   ICI on gère la version "pages" 
   (/admin/...) pour Produits, Magasins, etc.
*/

// Dashboard (existant)
app.get('/admin/dashboard', async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const todaysLivraisons = await models.Livraison.findAll({
      where: { date_livraison: today },
      include: [
        { model: models.LivraisonDetail, include: [models.Produit] },
        { model: models.Magasin }
      ]
    });

    let totalHT = 0;
    todaysLivraisons.forEach(liv => {
      const marge = liv.Magasin.marge || 20;
      liv.LivraisonDetails.forEach(ld => {
        const pv = parseFloat(ld.Produit.prix_vente) || 0;
        totalHT += (pv * (1 - marge/100)) * ld.quantite;
      });
    });

    res.render('admin/dashboard', { totalHT });
  } catch (err) {
    console.error('Erreur Dashboard:', err);
    res.status(500).send('Erreur chargement dashboard');
  }
});

// === PRODUITS (EJS) ===

// 1) Liste
app.get('/admin/produits', async (req, res) => {
  try {
    const produits = await models.Produit.findAll();
    // Rendre la vue EJS "admin/produits.ejs"
    res.render('admin/produits', { produits });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur chargement produits');
  }
});

// 2) Formulaire Nouveau
app.get('/admin/produits/new', (req, res) => {
  res.render('admin/newProduit');
});

// 3) Création
app.post('/admin/produits', async (req, res) => {
  try {
    // Récup le form
    const { nom, prix_vente, prix_achat } = req.body;
    await models.Produit.create({ nom, prix_vente, prix_achat });
    // On redirige vers la liste
    res.redirect('/admin/produits');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur création produit');
  }
});

// === MAGASINS (EJS) ===

app.get('/admin/magasins', async (req, res) => {
  try {
    const magasins = await models.Magasin.findAll();
    res.render('admin/magasins', { magasins });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur chargement magasins');
  }
});

// === FACTURES (EJS) ===
app.get('/admin/factures', async (req, res) => {
  try {
    // Ex: On liste toutes les "Invoice"
    const factures = await models.Invoice.findAll({
      include: [models.Magasin]
    });
    res.render('admin/factures', { factures });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur chargement factures');
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
