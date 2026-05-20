const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/contatos',  require('./routes/contacts'));
app.use('/api/campanhas', require('./routes/campaigns'));
app.use('/api/fluxos',    require('./routes/flows'));
app.use('/api/whatsapp',  require('./routes/whatsapp'));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
