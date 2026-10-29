
const express = require('express');
const path = require('node:path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const publicPath = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'kaipittyblox' });
});

app.use(express.static(publicPath));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`KaiPittyBlox berjalan di port ${PORT}`);
});