const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { getDb } = require('../database/db');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM contatos ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/importar', upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Arquivo nao enviado' });
  try {
    const records = parse(req.file.buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    const db = getDb();
    const stmt = db.prepare('INSERT OR IGNORE INTO contatos (nome, telefone) VALUES (?, ?)');
    let importados = 0;
    let ignorados = 0;
    db.transaction(() => {
      for (const r of records) {
        const nome = (r.nome || r.Nome || '').trim();
        const telefone = (r.telefone || r.Telefone || r.phone || '').trim();
        if (!telefone) { ignorados++; continue; }
        const { changes } = stmt.run(nome, telefone);
        changes ? importados++ : ignorados++;
      }
    })();
    res.json({ sucesso: true, importados, ignorados, total: records.length });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM contatos WHERE id = ?').run(req.params.id);
  res.json({ sucesso: true });
});

module.exports = router;
