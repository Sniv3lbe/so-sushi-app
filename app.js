// app.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const sequelize = require('./config/database');
const models = require('./models'); // chargera Magasin, Produit, Livraison, etc.

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares pour parser les JSON / forms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1) Configuration Multer (pour l'upload de photos/signatures)
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

// 2) Test de connexion DB + synchronisation
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

// ROUTE DE TEST
app.get('/', (req, res) => {
  res.send('Hello from So Sushi App with Sequelize models!');
});

// 3) Routes Magasins (CRUD minimal)
//    - POST /magasins => crée un magasin
//    - GET /magasins  => liste des magasins
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

// 4) Routes Produits
//    - POST /produits => créer un produit
//    - GET /produits  => lister
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

// 5) Route Livraisons
//    On reçoit : magasinId, date_livraison, responsable_so_sushi, responsable_carrefour
//                signature (base64?), photo (upload), details (tableau [{produitId, quantite}])
app.post('/livraisons', upload.single('photo'), async (req, res) => {
  try {
    const {
      magasinId,
      date_livraison,
      responsable_so_sushi,
      responsable_carrefour,
      signature,  // base64 string
      details     // JSON string : ex. '[{"produitId":1,"quantite":2}, ...]'
    } = req.body;

    let photoPath = null;
    if (req.file) {
      photoPath = req.file.path; // ex: "uploads/1689456129_123456.jpg"
    }

    // 1) Création de la livraison
    const newLivraison = await models.Livraison.create({
      magasinId,
      date_livraison,
      responsable_so_sushi,
      responsable_carrefour,
      signature,
      photo: photoPath
    });

    // 2) Création des détails
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

// 6) Route Récupérations
//    On reçoit : magasinId, date_recuperation, responsable_so_sushi, responsable_carrefour
//                signature (base64?), photo (upload), details
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

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
