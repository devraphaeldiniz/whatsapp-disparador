// Lê a variável de ambiente para decidir se usa mock ou WhatsApp real
// WHATSAPP_MOCK=true → simula envios no terminal sem precisar de sessão
// WHATSAPP_MOCK=false → usa WPPConnect para envio real
const USE_MOCK = process.env.WHATSAPP_MOCK !== 'false';

let client = null;          // instância do WPPConnect quando conectado
let clientStatus = 'disconnected';
let qrCodeBase64 = null;    // armazena o QR code para exibir na API

// Inicializa a conexão com o WhatsApp
// Chamado uma vez ao iniciar o servidor (server.js)
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

      // Chamado quando o QR code é gerado — armazena para servir via API
      catchQR: (b64) => {
        qrCodeBase64 = b64;
        console.log('QR disponivel em /api/whatsapp/qr');
      },

      // Atualiza o status da conexão conforme eventos do WPPConnect
      statusFind: (s) => { clientStatus = s; },

      headless: true,  // roda o Chrome em modo invisível
      logQR: false,    // não loga o QR no terminal
    });

    clientStatus = 'connected';
    console.log('WhatsApp conectado');
  } catch (err) {
    clientStatus = 'error';
    console.error('WhatsApp erro:', err.message);
  }
}

// Envia uma mensagem para um número de telefone
// Chamado pelo worker — nunca diretamente pelos controllers
async function sendMessage(telefone, mensagem) {
  if (USE_MOCK) {
    // Simula o tempo real de envio com delay aleatório entre 200ms e 800ms
    await new Promise(r => setTimeout(r, Math.random() * 600 + 200));

    // Simula 5% de falha para testar o mecanismo de retry da fila
    if (Math.random() < 0.05) throw new Error('Mock: falha simulada');

    console.log('MOCK -> ' + telefone + ': ' + mensagem.substring(0, 50));
    return { success: true };
  }

  if (!client || clientStatus !== 'connected') {
    throw new Error('WhatsApp nao conectado');
  }

  // Remove caracteres não numéricos e formata para o padrão do WhatsApp
  const phone = telefone.replace(/\D/g, '');
  await client.sendText(phone + '@c.us', mensagem);
  return { success: true };
}

// Retorna o status atual da conexão para a rota /api/whatsapp/status
function getStatus() { return { status: clientStatus, mock: USE_MOCK }; }

// Retorna o QR code em base64 para a rota /api/whatsapp/qr
function getQr() { return qrCodeBase64; }

module.exports = { initWhatsApp, sendMessage, getStatus, getQr };
