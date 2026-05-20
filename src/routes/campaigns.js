const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { adicionarNaFila, statsFilaPorCampanha } = require('../services/queueService');

router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM campanhas ORDER BY created_at DESC').all());
});

router.post('/', (req, res) => {
  const { nome, mensagem, delay_min, delay_max } = req.body;
  if (!nome || !mensagem) return res.status(400).json({ erro: 'Nome e mensagem sao obrigatorios' });
  const { lastInsertRowid } = getDb().prepare(
    'INSERT INTO campanhas (nome, mensagem, delay_min, delay_max) VALUES (?, ?, ?, ?)'
  ).run(nome, mensagem, delay_min || 5, delay_max || 15);
  res.json({ id: lastInsertRowid, sucesso: true });
});

router.post('/:id/disparar', (req, res) => {
  const db = getDb();
  const campanha = db.prepare('SELECT * FROM campanhas WHERE id = ?').get(req.params.id);
  if (!campanha) return res.status(404).json({ erro: 'Campanha nao encontrada' });

  const contatos = db.prepare('SELECT * FROM contatos').all();
  if (!contatos.length) return res.status(400).json({ erro: 'Nenhum contato cadastrado' });

  let delayAcumulado = 0;
  db.transaction(() => {
    for (const contato of contatos) {
      const rand = Math.floor(Math.random() * (campanha.delay_max - campanha.delay_min + 1)) + campanha.delay_min;
      delayAcumulado += rand;
      adicionarNaFila({
        campanha_id: campanha.id,
        contato_id: contato.id,
        telefone: contato.telefone,
        mensagem: campanha.mensagem,
        delay_segundos: delayAcumulado,
      });
    }
  })();

  db.prepare('UPDATE campanhas SET status = ? WHERE id = ?').run('disparando', campanha.id);
  res.json({ sucesso: true, agendados: contatos.length, tempo_total_segundos: delayAcumulado });
});

router.get('/:id/stats', (req, res) => {
  res.json(statsFilaPorCampanha(req.params.id));
});

module.exports = router;
