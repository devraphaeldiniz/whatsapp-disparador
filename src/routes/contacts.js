const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { getDb } = require('../database/db');

// Configura o multer para guardar o arquivo na memória (sem salvar em disco)
// O arquivo CSV é processado diretamente do buffer e descartado após a importação
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/contatos
// Retorna todos os contatos ordenados do mais recente para o mais antigo
router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM contatos ORDER BY created_at DESC').all();
  res.json(rows);
});

// POST /api/contatos/importar
// Recebe um arquivo CSV via multipart/form-data e importa os contatos
// Usa INSERT OR IGNORE para não duplicar telefones já cadastrados
router.post('/importar', upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Arquivo nao enviado' });

  try {
    // Converte o buffer do arquivo para string e faz o parse do CSV
    // A opção columns:true usa a primeira linha como cabeçalho
    const records = parse(req.file.buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true, // remove espaços extras de cada campo
    });

    const db = getDb();

    // Prepara o statement uma vez e reutiliza para cada linha — mais eficiente
    // OR IGNORE ignora silenciosamente telefones já existentes no banco
    const stmt = db.prepare('INSERT OR IGNORE INTO contatos (nome, telefone) VALUES (?, ?)');

    let importados = 0;
    let ignorados = 0;

    // Usa transaction para inserir todos os registros em uma única operação
    // Muito mais rápido do que uma transaction por linha
    db.transaction(() => {
      for (const r of records) {
        // Aceita variações de capitalização nos cabeçalhos do CSV (nome, Nome)
        const nome = (r.nome || r.Nome || '').trim();
        const telefone = (r.telefone || r.Telefone || r.phone || '').trim();

        // Ignora linhas sem telefone
        if (!telefone) { ignorados++; continue; }

        const { changes } = stmt.run(nome, telefone);

        // changes === 1 significa que foi inserido, 0 significa que foi ignorado
        changes ? importados++ : ignorados++;
      }
    })();

    res.json({ sucesso: true, importados, ignorados, total: records.length });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/contatos/:id
// Remove um contato pelo ID
router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM contatos WHERE id = ?').run(req.params.id);
  res.json({ sucesso: true });
});

module.exports = router;
