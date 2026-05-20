const express = require('express');
const router = express.Router();
const { getStatus, getQr } = require('../services/whatsapp');

// GET /api/whatsapp/status
// Retorna o status atual da conexão com o WhatsApp
// Usado pelo frontend para atualizar o indicador na sidebar a cada 8 segundos
router.get('/status', (req, res) => {
  res.json(getStatus());
});

// GET /api/whatsapp/qr
// Retorna o QR code em base64 para autenticação quando WHATSAPP_MOCK=false
// O QR é gerado pelo WPPConnect e armazenado em memória no serviço
router.get('/qr', (req, res) => {
  const qr = getQr();
  res.json(qr ? { qr } : { qr: null, msg: 'QR nao disponivel' });
});

module.exports = router;
