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
const models = require('./models'); // => index.js (Magasin, Produit, etc.)
const { Op } = require('sequelize');

const app = express();

// 1) Configuration EJS
app.set('view engine', 'ejs');

// 2) Port & Middlewares
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // pour les fichiers statiques (CSS, JS, etc.)

// 3) Configuration Multer (upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 4) Connexion DB + Sync
sequelize.authenticate()
  .then(() => {
    console.log('Connexion MySQL OK.');
    // force: true -> détruit et recrée toutes les tables à chaque démarrage
    return sequelize.sync({ force: true });
  })
  .then(() => {
    console.log('Tables synchronisées (force: true) !');
  })
  .catch(err => console.error('Erreur sync DB :', err));

// 5) Route racine
app.get('/', (req, res) => {
  res.send('Hello from So Sushi App with Sequelize models + Dashboard!');
});

/* 
   ================================================================
   ================ SECTION : API JSON (CRUD minimal) ============= 
   ================================================================
   Conserve ces routes si tu veux des endpoints JSON
*/

// -- Magasins (API JSON) --
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

// -- Produits (API JSON) --
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

// -- Livraisons (API JSON) --
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

// -- Récupérations (API JSON) --
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

/*
   ================================================================
   ==================== SECTION ADMIN (EJS) =======================
   ================================================================
   Routes pour /admin/..., affichant des vues EJS
*/

// -- Dashboard --
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
        totalHT += (pv * (1 - marge / 100)) * ld.quantite;
      });
    });

    res.render('admin/dashboard', { totalHT });
  } catch (err) {
    console.error('Erreur Dashboard:', err);
    res.status(500).send('Erreur chargement dashboard');
  }
});

// -- PRODUITS (EJS) --

// Liste des produits (EJS)
app.get('/admin/produits', async (req, res) => {
  try {
    const produits = await models.Produit.findAll();
    res.render('admin/produits', { produits });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur chargement produits');
  }
});

// Formulaire "Nouveau produit"
app.get('/admin/produits/new', (req, res) => {
  res.render('admin/newProduit');
});

// POST création produit
app.post('/admin/produits', async (req, res) => {
  try {
    const { nom, prix_vente, prix_achat } = req.body;
    await models.Produit.create({ nom, prix_vente, prix_achat });
    return res.redirect('/admin/produits');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur création produit');
  }
});

// -- MAGASINS (EJS) --

// Liste des magasins (EJS)
app.get('/admin/magasins', async (req, res) => {
  try {
    const magasins = await models.Magasin.findAll();
    res.render('admin/magasins', { magasins });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur chargement magasins');
  }
});

// Formulaire "Nouveau magasin"
app.get('/admin/magasins/new', (req, res) => {
  res.render('admin/newMagasin');
});

// POST création magasin
app.post('/admin/magasins', async (req, res) => {
  try {
    const { nom, adresse, email_notification, marge, delai_paiement } = req.body;
    await models.Magasin.create({
      nom,
      adresse,
      email_notification,
      marge,
      delai_paiement
    });
    return res.redirect('/admin/magasins');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur création magasin');
  }
});

// -- FACTURES (EJS) --

// Liste des factures (EJS)
app.get('/admin/factures', async (req, res) => {
  try {
    const factures = await models.Invoice.findAll({ include: [models.Magasin] });
    res.render('admin/factures', { factures });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur chargement factures');
  }
});

// Formulaire "Nouvelle facture"
app.get('/admin/factures/new', (req, res) => {
  res.render('admin/newFacture');
});

// POST création facture
app.post('/admin/factures', async (req, res) => {
  try {
    // Récupère le form : ex: const { magasinId, dateFacture } = req.body;
    // ... stocke en DB ou effectue la logique
    return res.redirect('/admin/factures');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur création facture');
  }
});

// 6) Lancement du serveur
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
