const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Diretório onde o arquivo do banco será salvo
const DATA_DIR = path.join(__dirname, '../../data');

// Cria o diretório /data se não existir ainda
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let _db;

// Singleton — garante que só existe uma conexão aberta com o banco
function getDb() {
  if (!_db) {
    _db = new Database(path.join(DATA_DIR, 'database.sqlite'));

    // WAL melhora performance em leituras e escritas simultâneas
    _db.pragma('journal_mode = WAL');

    // Garante integridade referencial entre tabelas (foreign keys)
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

module.exports = { getDb };
