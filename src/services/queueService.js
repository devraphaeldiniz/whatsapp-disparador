const { getDb } = require('../database/db');

// Insere um novo item na fila de envio com o horário calculado pelo delay
// O controller chama esta função — nunca envia diretamente
function adicionarNaFila({ campanha_id, contato_id, telefone, mensagem, delay_segundos }) {
  const db = getDb();

  // Calcula o momento exato de envio somando o delay ao horário atual
  const agendado_para = new Date(Date.now() + delay_segundos * 1000).toISOString();

  return db.prepare(
    'INSERT INTO fila_envio (campanha_id, contato_id, telefone, mensagem, agendado_para) VALUES (?, ?, ?, ?, ?)'
  ).run(campanha_id, contato_id, telefone, mensagem, agendado_para);
}

// Busca itens pendentes cujo horário de envio já chegou
// Chamado pelo worker a cada 5 segundos
function buscarPendentes(limite) {
  return getDb().prepare(
    'SELECT * FROM fila_envio WHERE status = ? AND agendado_para <= ? ORDER BY agendado_para ASC LIMIT ?'
  ).all('pendente', new Date().toISOString(), limite || 5);
}

// Marca um item como enviado com sucesso, registrando o horário
function marcarComoEnviado(id) {
  return getDb().prepare(
    'UPDATE fila_envio SET status = ?, enviado_em = CURRENT_TIMESTAMP WHERE id = ?'
  ).run('enviado', id);
}

// Trata falha de envio com lógica de retry
// Até 3 tentativas: reagenda para 60s depois
// Após 3 falhas: marca como falhou definitivamente
function marcarComoErro(id, erro, tentativas) {
  const db = getDb();
  const novas = tentativas + 1;
  const falhou = novas >= 3;
  const proxima = new Date(Date.now() + 60000).toISOString();

  db.prepare(
    'UPDATE fila_envio SET status = ?, tentativas = ?, erro = ?, agendado_para = ? WHERE id = ?'
  ).run(
    falhou ? 'falhou' : 'pendente',
    novas,
    erro,
    falhou ? new Date().toISOString() : proxima,
    id
  );
}

// Retorna contagem de itens agrupados por status para exibir no painel
function statsFilaPorCampanha(campanha_id) {
  return getDb().prepare(
    'SELECT status, COUNT(*) as total FROM fila_envio WHERE campanha_id = ? GROUP BY status'
  ).all(campanha_id);
}

module.exports = { adicionarNaFila, buscarPendentes, marcarComoEnviado, marcarComoErro, statsFilaPorCampanha };
