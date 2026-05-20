const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET /api/fluxos
// Retorna todos os fluxos ordenados do mais recente para o mais antigo
router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM fluxos ORDER BY created_at DESC').all());
});

// GET /api/fluxos/:id
// Retorna um fluxo específico com todas as suas etapas ordenadas
router.get('/:id', (req, res) => {
  const db = getDb();
  const fluxo = db.prepare('SELECT * FROM fluxos WHERE id = ?').get(req.params.id);
  if (!fluxo) return res.status(404).json({ erro: 'Fluxo nao encontrado' });

  // Busca as etapas ordenadas pelo campo ordem (0, 1, 2...)
  const etapas = db.prepare('SELECT * FROM fluxo_etapas WHERE fluxo_id = ? ORDER BY ordem').all(req.params.id);

  // Retorna o fluxo com as etapas embutidas no mesmo objeto
  res.json({ ...fluxo, etapas });
});

// POST /api/fluxos
// Cria um novo fluxo com suas etapas em uma única operação atômica
router.post('/', (req, res) => {
  const { nome, etapas } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  if (!etapas || !etapas.length) return res.status(400).json({ erro: 'Fluxo precisa ter ao menos 1 etapa' });

  const db = getDb();

  // Transaction garante que o fluxo e todas as etapas são criados juntos
  // Se qualquer inserção falhar, nada é salvo no banco
  const fluxo_id = db.transaction(() => {
    const { lastInsertRowid } = db.prepare('INSERT INTO fluxos (nome) VALUES (?)').run(nome);

    // Prepara o statement uma vez e reutiliza para cada etapa
    const stmt = db.prepare('INSERT INTO fluxo_etapas (fluxo_id, ordem, mensagem, delay_segundos) VALUES (?, ?, ?, ?)');

    // Usa o índice do array como ordem da etapa (0, 1, 2...)
    etapas.forEach((e, i) => stmt.run(lastInsertRowid, i, e.mensagem, e.delay_segundos || 0));

    return lastInsertRowid;
  })();

  res.json({ id: fluxo_id, sucesso: true });
});

// DELETE /api/fluxos/:id
// Remove o fluxo, suas etapas e todas as execuções associadas
router.delete('/:id', (req, res) => {
  const db = getDb();
  const fluxo = db.prepare('SELECT * FROM fluxos WHERE id = ?').get(req.params.id);
  if (!fluxo) return res.status(404).json({ erro: 'Fluxo nao encontrado' });

  // Transaction garante que tudo é removido ou nada é removido
  // A ordem importa: remove execuções e etapas antes do fluxo (foreign keys)
  db.transaction(() => {
    db.prepare('DELETE FROM execucao_fluxo WHERE fluxo_id = ?').run(req.params.id);
    db.prepare('DELETE FROM fluxo_etapas WHERE fluxo_id = ?').run(req.params.id);
    db.prepare('DELETE FROM fluxos WHERE id = ?').run(req.params.id);
  })();

  res.json({ sucesso: true });
});

// POST /api/fluxos/:id/adicionar-lista
// Adiciona todos os contatos cadastrados ao fluxo
// Contatos já ativos no fluxo são ignorados para evitar duplicação
router.post('/:id/adicionar-lista', (req, res) => {
  const db = getDb();
  const fluxo = db.prepare('SELECT * FROM fluxos WHERE id = ?').get(req.params.id);
  if (!fluxo) return res.status(404).json({ erro: 'Fluxo nao encontrado' });

  // Busca a primeira etapa para saber qual ordem usar ao iniciar a execução
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
      // Verifica se o contato já está ativo neste fluxo para não duplicar
      const jaAtivo = db.prepare(
        'SELECT id FROM execucao_fluxo WHERE fluxo_id = ? AND contato_id = ? AND status = ?'
      ).get(req.params.id, c.id, 'ativo');

      if (!jaAtivo) {
        // proxima_execucao = agora → worker processa na próxima verificação (5s)
        stmt.run(req.params.id, c.id, primeiraEtapa.ordem, new Date().toISOString());
        count++;
      }
    }
    return count;
  })();

  res.json({ sucesso: true, adicionados, ignorados: contatos.length - adicionados });
});

// GET /api/fluxos/:id/execucoes
// Retorna todas as execuções de um fluxo com dados do contato
// Usado no painel para mostrar o progresso de cada contato no fluxo
router.get('/:id/execucoes', (req, res) => {
  const rows = getDb().prepare(
    'SELECT ef.*, c.nome, c.telefone FROM execucao_fluxo ef JOIN contatos c ON c.id = ef.contato_id WHERE ef.fluxo_id = ? ORDER BY ef.iniciado_em DESC'
  ).all(req.params.id);
  res.json(rows);
});

module.exports = router;
