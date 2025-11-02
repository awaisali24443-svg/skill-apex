
const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

// Dynamically generate a configuration script to pass the API key to the frontend
app.get('/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  // Polyfill process.env for the browser to access the API_KEY
  res.send(`
    window.process = {
      env: {
        API_KEY: '${process.env.API_KEY}'
      }
    };
  `);
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '.')));

// Handle SPA routing by sending all other requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
