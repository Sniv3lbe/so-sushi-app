// app.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const moment = require('moment'); // pour formater les dates
const nodemailer = require('nodemailer'); // <-- N'oublie pas d'installer nodemailer (npm install nodemailer)

// Sequelize + modèles
const sequelize = require('./config/database');
const models = require('./models'); // chargera Magasin, Produit, Livraison, etc.

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares pour parser JSON / urlencoded
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
//                signature, photo, details
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

// 7) Route pour générer une facture (PDF)
app.get('/facture/:magasinId/:startDate/:endDate', async (req, res) => {
  try {
    const { magasinId, startDate, endDate } = req.params;

    // 1) Récupérer le magasin
    const magasin = await models.Magasin.findByPk(magasinId);
    if (!magasin) {
      return res.status(404).json({ message: 'Magasin introuvable' });
    }

    // 2) Récupérer toutes les livraisons sur la période (jointure sur LivraisonDetail + Produit)
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

    // 3) Récupérer toutes les récupérations sur la période
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

    // 4) Calcul des montants
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

    // 5) Génération du PDF avec PDFKit
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Envoyer le PDF en streaming dans la réponse HTTP
    res.setHeader('Content-Type', 'application/pdf');
    // Pour forcer le téléchargement, décommente la ligne ci-dessous :
    // res.setHeader('Content-Disposition', 'attachment; filename=facture.pdf');

    doc.fontSize(20).text('FACTURE / INVOICE', { align: 'center' });
    doc.moveDown();

    // Infos principales
    const invoiceNumber = `2025-SSC-${Date.now()}`;
    doc.fontSize(12).text(`Facture N°: ${invoiceNumber}`);
    doc.text(`Date: ${moment().format('YYYY-MM-DD')}`);
    doc.text(`Période: du ${startDate} au ${endDate}`);
    doc.text(`Magasin: ${magasin.nom}`);
    doc.moveDown();

    // Détails des montants
    doc.text(`Total Livraisons HT: ${totalLivraisonHT.toFixed(2)} €`);
    doc.text(`Total Récupérations HT: ${totalRecuperationHT.toFixed(2)} €`);
    doc.text(`Net HT (liv - récup): ${netHT.toFixed(2)} €`);
    doc.text(`TVA (6%): ${tva.toFixed(2)} €`);
    doc.text(`Total TTC: ${totalTTC.toFixed(2)} €`);
    doc.moveDown();

    // Coordonnées de paiement (exemple)
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

// 8) Route pour envoyer la facture par email
app.post('/facture/email', async (req, res) => {
  try {
    const { magasinId, startDate, endDate, emailDest } = req.body;

    // 1) Ici, tu peux reprendre la logique de calcul (totaux, TVA, etc.)
    //    ou faire quelque chose de simplifié :
    const totalLivraisonHT = 100;   // Exemple
    const totalRecuperationHT = 20; // Exemple
    const netHT = 80;              // Exemple
    const tvaRate = 0.06;
    const tva = netHT * tvaRate;
    const totalTTC = netHT + tva;

    // 2) Générer le PDF dans un buffer
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    let buffers = [];
    
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', async () => {
      // Quand le PDF est fini, on convertit le tableau de chunks en buffer
      let pdfData = Buffer.concat(buffers);

      // 3) Envoyer l'email avec la PJ
      let transporter = nodemailer.createTransport({
        host: 'smtp.monserveur.com',
        port: 587,
        secure: false, // true si SSL
        auth: {
          user: 'monuser@exemple.com',
          pass: 'secret'
        }
      });

      let mailOptions = {
        from: '"So Sushi" <noreply@sosushi.be>',
        to: emailDest, 
        subject: "Votre facture So Sushi",
        text: "Veuillez trouver ci-joint votre facture.",
        attachments: [
          {
            filename: 'facture.pdf',
            content: pdfData,
            contentType: 'application/pdf'
          }
        ]
      };

      let info = await transporter.sendMail(mailOptions);
      console.log("Mail envoyé: " + info.messageId);
      return res.json({ message: 'Facture envoyée par email avec succès' });
    });

    // Contenu du PDF (exemple)
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

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
