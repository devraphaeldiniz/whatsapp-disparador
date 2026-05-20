const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM fluxos ORDER BY created_at DESC').all());
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const fluxo = db.prepare('SELECT * FROM fluxos WHERE id = ?').get(req.params.id);
  if (!fluxo) return res.status(404).json({ erro: 'Fluxo nao encontrado' });
  const etapas = db.prepare('SELECT * FROM fluxo_etapas WHERE fluxo_id = ? ORDER BY ordem').all(req.params.id);
  res.json({ ...fluxo, etapas });
});

router.post('/', (req, res) => {
  const { nome, etapas } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  if (!etapas || !etapas.length) return res.status(400).json({ erro: 'Fluxo precisa ter ao menos 1 etapa' });

  const db = getDb();
  const fluxo_id = db.transaction(() => {
    const { lastInsertRowid } = db.prepare('INSERT INTO fluxos (nome) VALUES (?)').run(nome);
    const stmt = db.prepare('INSERT INTO fluxo_etapas (fluxo_id, ordem, mensagem, delay_segundos) VALUES (?, ?, ?, ?)');
    etapas.forEach((e, i) => stmt.run(lastInsertRowid, i, e.mensagem, e.delay_segundos || 0));
    return lastInsertRowid;
  })();

  res.json({ id: fluxo_id, sucesso: true });
});

router.post('/:id/adicionar-lista', (req, res) => {
  const db = getDb();
  const fluxo = db.prepare('SELECT * FROM fluxos WHERE id = ?').get(req.params.id);
  if (!fluxo) return res.status(404).json({ erro: 'Fluxo nao encontrado' });

  const primeiraEtapa = db.prepare(
    'SELECT * FROM fluxo_etapas WHERE fluxo_id = ? ORDER BY ordem ASC LIMIT 1'
  ).get(req.params.id);
  if (!primeiraEtapa) return res.status(400).json({ erro: 'Fluxo sem etapas' });

  const contatos = db.prepare('SELECT * FROM contatos').all();
  if (!contatos.length) return res.status(400).json({ erro: 'Nenhum contato cadastrado' });

  const stmt = db.prepare(
    'INSERT INTO execucao_fluxo (fluxo_id, contato_id, etapa_atual, proxima_execucao) VALUES (?, ?, ?, ?)'
  );

  const adicionados = db.transaction(() => {
    let count = 0;
    for (const c of contatos) {
      const jaAtivo = db.prepare(
        'SELECT id FROM execucao_fluxo WHERE fluxo_id = ? AND contato_id = ? AND status = ?'
      ).get(req.params.id, c.id, 'ativo');
      if (!jaAtivo) {
        stmt.run(req.params.id, c.id, primeiraEtapa.ordem, new Date().toISOString());
        count++;
      }
    }
    return count;
  })();

  res.json({ sucesso: true, adicionados, ignorados: contatos.length - adicionados });
});

router.get('/:id/execucoes', (req, res) => {
  const rows = getDb().prepare(
    'SELECT ef.*, c.nome, c.telefone FROM execucao_fluxo ef JOIN contatos c ON c.id = ef.contato_id WHERE ef.fluxo_id = ? ORDER BY ef.iniciado_em DESC'
  ).all(req.params.id);
  res.json(rows);
});

module.exports = router;
