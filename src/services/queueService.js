const { getDb } = require('../database/db');

function adicionarNaFila({ campanha_id, contato_id, telefone, mensagem, delay_segundos }) {
  const db = getDb();
  const agendado_para = new Date(Date.now() + delay_segundos * 1000).toISOString();
  return db.prepare(
    'INSERT INTO fila_envio (campanha_id, contato_id, telefone, mensagem, agendado_para) VALUES (?, ?, ?, ?, ?)'
  ).run(campanha_id, contato_id, telefone, mensagem, agendado_para);
}

function buscarPendentes(limite) {
  return getDb().prepare(
    'SELECT * FROM fila_envio WHERE status = ? AND agendado_para <= ? ORDER BY agendado_para ASC LIMIT ?'
  ).all('pendente', new Date().toISOString(), limite || 5);
}

function marcarComoEnviado(id) {
  return getDb().prepare(
    'UPDATE fila_envio SET status = ?, enviado_em = CURRENT_TIMESTAMP WHERE id = ?'
  ).run('enviado', id);
}

function marcarComoErro(id, erro, tentativas) {
  const db = getDb();
  const novas = tentativas + 1;
  const falhou = novas >= 3;
  const proxima = new Date(Date.now() + 60000).toISOString();
  db.prepare(
    'UPDATE fila_envio SET status = ?, tentativas = ?, erro = ?, agendado_para = ? WHERE id = ?'
  ).run(falhou ? 'falhou' : 'pendente', novas, erro, falhou ? new Date().toISOString() : proxima, id);
}

function statsFilaPorCampanha(campanha_id) {
  return getDb().prepare(
    'SELECT status, COUNT(*) as total FROM fila_envio WHERE campanha_id = ? GROUP BY status'
  ).all(campanha_id);
}

module.exports = { adicionarNaFila, buscarPendentes, marcarComoEnviado, marcarComoErro, statsFilaPorCampanha };
