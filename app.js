// app.js

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// On importe l'instance Sequelize configurée
const sequelize = require('./config/database');

// On importe tous les modèles pour qu'ils s'enregistrent automatiquement
const models = require('./models'); // charge models/index.js

// Test de connexion + synchronisation des tables
sequelize.authenticate()
  .then(() => {
    console.log('Connexion MySQL OK.');
    
    // Synchroniser la base (force: false pour ne pas recréer les tables à chaque démarrage)
    return sequelize.sync({ force: false });
  })
  .then(() => {
    console.log('Tables synchronisées !');
  })
  .catch(err => console.error('Erreur sync DB :', err));

// Exemple de route
app.get('/', (req, res) => {
  res.send('Hello from So Sushi App with Sequelize models!');
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
