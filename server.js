const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const routes = require('./routes/queryRoutes');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Added JSON parser for API requests
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', routes);

// Handle 404
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Running at http://localhost:${PORT}`);
});