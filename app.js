// app.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// On importe le sequelize configuré
const sequelize = require('./config/database');

// Test de connexion
sequelize.authenticate()
  .then(() => console.log('Connexion MySQL OK.'))
  .catch(err => console.error('Erreur connexion MySQL :', err));

app.get('/', (req, res) => {
  res.send('Hello from So Sushi App with DB config!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
