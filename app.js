const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Route de test
app.get('/', (req, res) => {
  res.send('Hello from So Sushi App!');
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

