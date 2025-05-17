const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

// Serve static files from both directories
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Serve CSS file directly
app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'styles.css'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/model', (req, res) => {
  res.sendFile(path.join(__dirname, 'model.html'));
});

app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  exec(`start http://localhost:${PORT}`);
});
