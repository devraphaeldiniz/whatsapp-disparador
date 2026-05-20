const express = require('express');
const router = express.Router();
const { getStatus, getQr } = require('../services/whatsapp');

router.get('/status', (req, res) => {
  res.json(getStatus());
});

router.get('/qr', (req, res) => {
  const qr = getQr();
  res.json(qr ? { qr } : { qr: null, msg: 'QR nao disponivel' });
});

module.exports = router;
