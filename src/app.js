const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Permite requisições de origens diferentes (útil em desenvolvimento)
app.use(cors());

// Interpreta o body das requisições como JSON automaticamente
app.use(express.json());

// Serve os arquivos estáticos da pasta public (index.html, css, js)
app.use(express.static(path.join(__dirname, '../public')));

// Registra as rotas da API — cada módulo gerencia seu próprio prefixo
app.use('/api/contatos',  require('./routes/contacts'));
app.use('/api/campanhas', require('./routes/campaigns'));
app.use('/api/fluxos',    require('./routes/flows'));
app.use('/api/whatsapp',  require('./routes/whatsapp'));

// Fallback para qualquer rota não reconhecida
// Retorna o index.html permitindo que o frontend gerencie a navegação
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
