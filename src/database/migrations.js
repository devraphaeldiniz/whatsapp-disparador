const { getDb } = require('./db');

function runMigrations() {
  const db = getDb();

  // Executa todas as criações de tabela em um único bloco SQL
  // IF NOT EXISTS garante que rodar novamente não apaga dados existentes
  db.exec(`

    -- Armazena os contatos importados via CSV
    CREATE TABLE IF NOT EXISTS contatos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Armazena as campanhas de disparo simples criadas pelo usuário
    CREATE TABLE IF NOT EXISTS campanhas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      delay_min INTEGER NOT NULL DEFAULT 5,  -- delay mínimo entre envios em segundos
      delay_max INTEGER NOT NULL DEFAULT 15, -- delay máximo entre envios em segundos
      status TEXT DEFAULT 'rascunho',        -- rascunho | disparando | concluido
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Fila persistida de mensagens agendadas
    -- Cada linha representa um envio individual para um contato
    -- O worker consulta esta tabela para saber o que precisa ser enviado
    CREATE TABLE IF NOT EXISTS fila_envio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campanha_id INTEGER,
      contato_id INTEGER,
      telefone TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      status TEXT DEFAULT 'pendente',   -- pendente | enviado | falhou
      agendado_para DATETIME NOT NULL,  -- momento exato em que deve ser enviado
      enviado_em DATETIME,              -- preenchido quando o envio ocorre
      tentativas INTEGER DEFAULT 0,     -- contador de tentativas em caso de falha
      erro TEXT,                        -- mensagem de erro da última tentativa
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campanha_id) REFERENCES campanhas(id),
      FOREIGN KEY (contato_id) REFERENCES contatos(id)
    );

    -- Armazena os fluxos de mensagens sequenciais criados pelo usuário
    CREATE TABLE IF NOT EXISTS fluxos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Cada etapa de um fluxo com sua mensagem e delay em relação à etapa anterior
    CREATE TABLE IF NOT EXISTS fluxo_etapas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fluxo_id INTEGER NOT NULL,
      ordem INTEGER NOT NULL,           -- posição da etapa no fluxo (0, 1, 2...)
      mensagem TEXT NOT NULL,
      delay_segundos INTEGER NOT NULL DEFAULT 0, -- quanto tempo esperar após etapa anterior
      FOREIGN KEY (fluxo_id) REFERENCES fluxos(id)
    );

    -- Controla a execução individual de cada contato dentro de um fluxo
    -- Cada contato tem sua própria linha, garantindo independência total
    CREATE TABLE IF NOT EXISTS execucao_fluxo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fluxo_id INTEGER NOT NULL,
      contato_id INTEGER NOT NULL,
      etapa_atual INTEGER DEFAULT 0,        -- índice da etapa que será enviada
      proxima_execucao DATETIME NOT NULL,   -- quando o worker deve processar esta linha
      status TEXT DEFAULT 'ativo',          -- ativo | concluido
      iniciado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      finalizado_em DATETIME,
      FOREIGN KEY (fluxo_id) REFERENCES fluxos(id),
      FOREIGN KEY (contato_id) REFERENCES contatos(id)
    );
  `);

  console.log('Migrations OK');
}

module.exports = { runMigrations };
