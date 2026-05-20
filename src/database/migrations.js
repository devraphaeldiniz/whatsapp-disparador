const { getDb } = require('./db');

function runMigrations() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS contatos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS campanhas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      delay_min INTEGER NOT NULL DEFAULT 5,
      delay_max INTEGER NOT NULL DEFAULT 15,
      status TEXT DEFAULT 'rascunho',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fila_envio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campanha_id INTEGER,
      contato_id INTEGER,
      telefone TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      status TEXT DEFAULT 'pendente',
      agendado_para DATETIME NOT NULL,
      enviado_em DATETIME,
      tentativas INTEGER DEFAULT 0,
      erro TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campanha_id) REFERENCES campanhas(id),
      FOREIGN KEY (contato_id) REFERENCES contatos(id)
    );
    CREATE TABLE IF NOT EXISTS fluxos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fluxo_etapas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fluxo_id INTEGER NOT NULL,
      ordem INTEGER NOT NULL,
      mensagem TEXT NOT NULL,
      delay_segundos INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (fluxo_id) REFERENCES fluxos(id)
    );
    CREATE TABLE IF NOT EXISTS execucao_fluxo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fluxo_id INTEGER NOT NULL,
      contato_id INTEGER NOT NULL,
      etapa_atual INTEGER DEFAULT 0,
      proxima_execucao DATETIME NOT NULL,
      status TEXT DEFAULT 'ativo',
      iniciado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      finalizado_em DATETIME,
      FOREIGN KEY (fluxo_id) REFERENCES fluxos(id),
      FOREIGN KEY (contato_id) REFERENCES contatos(id)
    );
  `);
  console.log('Migrations OK');
}

module.exports = { runMigrations };
