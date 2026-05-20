require('dotenv').config();
const app = require('./app');
const { runMigrations } = require('./database/migrations');
const { initWhatsApp } = require('./services/whatsapp');
const { startWorker } = require('./workers/messageWorker');

const PORT = process.env.PORT || 3000;

async function main() {
  runMigrations();
  await initWhatsApp();
  startWorker();
  app.listen(PORT, () => {
    console.log('Servidor rodando em http://localhost:' + PORT);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
