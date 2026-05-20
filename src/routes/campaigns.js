const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { adicionarNaFila, statsFilaPorCampanha } = require('../services/queueService');

// GET /api/campanhas
// Retorna todas as campanhas ordenadas da mais recente para a mais antiga
router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM campanhas ORDER BY created_at DESC').all());
});

// POST /api/campanhas
// Cria uma nova campanha — apenas salva no banco, não dispara nada ainda
router.post('/', (req, res) => {
  const { nome, mensagem, delay_min, delay_max } = req.body;
  if (!nome || !mensagem) return res.status(400).json({ erro: 'Nome e mensagem sao obrigatorios' });

  const { lastInsertRowid } = getDb().prepare(
    'INSERT INTO campanhas (nome, mensagem, delay_min, delay_max) VALUES (?, ?, ?, ?)'
  ).run(nome, mensagem, delay_min || 5, delay_max || 15);

  res.json({ id: lastInsertRowid, sucesso: true });
});

// DELETE /api/campanhas/:id
// Remove uma campanha e todos os seus itens da fila de envio
router.delete('/:id', (req, res) => {
  const db = getDb();
  const campanha = db.prepare('SELECT * FROM campanhas WHERE id = ?').get(req.params.id);
  if (!campanha) return res.status(404).json({ erro: 'Campanha nao encontrada' });

  // Transaction garante que ou apaga tudo ou não apaga nada
  db.transaction(() => {
    db.prepare('DELETE FROM fila_envio WHERE campanha_id = ?').run(req.params.id);
    db.prepare('DELETE FROM campanhas WHERE id = ?').run(req.params.id);
  })();

  res.json({ sucesso: true });
});

// POST /api/campanhas/:id/disparar
// Enfileira mensagens para todos os contatos — NÃO envia diretamente
// O envio é feito pelo worker de forma assíncrona
router.post('/:id/disparar', (req, res) => {
  const db = getDb();
  const campanha = db.prepare('SELECT * FROM campanhas WHERE id = ?').get(req.params.id);
  if (!campanha) return res.status(404).json({ erro: 'Campanha nao encontrada' });

  const contatos = db.prepare('SELECT * FROM contatos').all();
  if (!contatos.length) return res.status(400).json({ erro: 'Nenhum contato cadastrado' });

  let delayAcumulado = 0;

  db.transaction(() => {
    for (const contato of contatos) {
      // Gera um delay aleatório entre delay_min e delay_max para cada contato
      const rand = Math.floor(Math.random() * (campanha.delay_max - campanha.delay_min + 1)) + campanha.delay_min;

      // Acumula o delay para que os envios sejam espaçados sequencialmente
      // Ex: contato1=8s, contato2=8+12=20s, contato3=20+9=29s
      delayAcumulado += rand;

      // Insere na fila com o horário calculado — o worker processa depois
      adicionarNaFila({
        campanha_id: campanha.id,
        contato_id: contato.id,
        telefone: contato.telefone,
        mensagem: campanha.mensagem,
        delay_segundos: delayAcumulado,
      });
    }
  })();

  // Atualiza status da campanha para indicar que está em andamento
  db.prepare('UPDATE campanhas SET status = ? WHERE id = ?').run('disparando', campanha.id);

  res.json({ sucesso: true, agendados: contatos.length, tempo_total_segundos: delayAcumulado });
});

// GET /api/campanhas/:id/stats
// Retorna contagem de envios agrupados por status (pendente, enviado, falhou)
router.get('/:id/stats', (req, res) => {
  res.json(statsFilaPorCampanha(req.params.id));
});

// GET /api/campanhas/:id/fila-detalhada
// Retorna cada item da fila individualmente com nome do contato
// Usado na aba Fila para exibir o status de cada envio
router.get('/:id/fila-detalhada', (req, res) => {
  const db = getDb();
  const itens = db.prepare(`
    SELECT fe.*, c.nome as contato_nome
    FROM fila_envio fe
    LEFT JOIN contatos c ON c.id = fe.contato_id
    WHERE fe.campanha_id = ?
    ORDER BY fe.agendado_para ASC
  `).all(req.params.id);
  res.json(itens);
});

module.exports = router;
