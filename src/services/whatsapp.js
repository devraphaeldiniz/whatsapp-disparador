const USE_MOCK = process.env.WHATSAPP_MOCK !== 'false';
let client = null;
let clientStatus = 'disconnected';
let qrCodeBase64 = null;

async function initWhatsApp() {
  if (USE_MOCK) {
    clientStatus = 'connected';
    console.log('WhatsApp: modo MOCK ativo');
    return;
  }
  try {
    const wpp = require('@wppconnect-team/wppconnect');
    client = await wpp.create({
      session: 'disparador',
      catchQR: (b64) => { qrCodeBase64 = b64; console.log('QR disponivel em /api/whatsapp/qr'); },
      statusFind: (s) => { clientStatus = s; },
      headless: true,
      logQR: false,
    });
    clientStatus = 'connected';
    console.log('WhatsApp conectado');
  } catch (err) {
    clientStatus = 'error';
    console.error('WhatsApp erro:', err.message);
  }
}

async function sendMessage(telefone, mensagem) {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, Math.random() * 600 + 200));
    if (Math.random() < 0.05) throw new Error('Mock: falha simulada');
    console.log('MOCK -> ' + telefone + ': ' + mensagem.substring(0, 50));
    return { success: true };
  }
  if (!client || clientStatus !== 'connected') throw new Error('WhatsApp nao conectado');
  const phone = telefone.replace(/\D/g, '');
  await client.sendText(phone + '@c.us', mensagem);
  return { success: true };
}

function getStatus() { return { status: clientStatus, mock: USE_MOCK }; }
function getQr() { return qrCodeBase64; }

module.exports = { initWhatsApp, sendMessage, getStatus, getQr };
