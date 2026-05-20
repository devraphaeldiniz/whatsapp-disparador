// Carrega as variáveis de ambiente do arquivo .env antes de qualquer outra coisa
require('dotenv').config();

const app = require('./app');
const { runMigrations } = require('./database/migrations');
const { initWhatsApp } = require('./services/whatsapp');
const { startWorker } = require('./workers/messageWorker');

const PORT = process.env.PORT || 3000;

// Função principal que inicializa todos os módulos na ordem correta
async function main() {
  // 1. Cria as tabelas no banco se ainda não existirem
  runMigrations();

  // 2. Inicializa a conexão com o WhatsApp (real ou mock)
  await initWhatsApp();

  // 3. Inicia o worker que processa a fila e os fluxos a cada 5 segundos
  //    Roda de forma contínua e independente do navegador
  startWorker();

  // 4. Sobe o servidor HTTP para receber requisições do frontend
  app.listen(PORT, () => {
    console.log('Servidor rodando em http://localhost:' + PORT);
  });
}

// Executa e trata erros fatais de inicialização
main().catch(err => {
  console.error(err);
  process.exit(1);
});
