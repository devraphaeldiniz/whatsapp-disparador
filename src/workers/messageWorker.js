const { buscarPendentes, marcarComoEnviado, marcarComoErro } = require('../services/queueService');
const { sendMessage } = require('../services/whatsapp');
const { getDb } = require('../database/db');

let intervalo = null;
let processando = false;

async function processarFila() {
  const itens = buscarPendentes(5);
  for (const item of itens) {
    try {
      await sendMessage(item.telefone, item.mensagem);
      marcarComoEnviado(item.id);
      console.log('[FILA] Enviado #' + item.id + ' -> ' + item.telefone);
    } catch (err) {
      marcarComoErro(item.id, err.message, item.tentativas);
      console.error('[FILA] Erro #' + item.id + ': ' + err.message);
    }
  }
}

async function processarFluxos() {
  const db = getDb();
  const execucoes = db.prepare(
    'SELECT ef.*, c.telefone, c.nome FROM execucao_fluxo ef JOIN contatos c ON c.id = ef.contato_id WHERE ef.status = ? AND ef.proxima_execucao <= ? LIMIT 20'
  ).all('ativo', new Date().toISOString());

  for (const exec of execucoes) {
    try {
      const etapa = db.prepare(
        'SELECT * FROM fluxo_etapas WHERE fluxo_id = ? AND ordem = ?'
      ).get(exec.fluxo_id, exec.etapa_atual);

      if (!etapa) {
        db.prepare(
          'UPDATE execucao_fluxo SET status = ?, finalizado_em = CURRENT_TIMESTAMP WHERE id = ?'
        ).run('concluido', exec.id);
        console.log('[FLUXO] Exec #' + exec.id + ' concluida');
        continue;
      }

      try {
        await sendMessage(exec.telefone, etapa.mensagem);
        console.log('[FLUXO] Exec #' + exec.id + ' etapa ' + exec.etapa_atual + ' -> ' + exec.telefone);
      } catch (err) {
        console.error('[FLUXO] Erro ao enviar exec #' + exec.id + ': ' + err.message);
      }

      const proxima = db.prepare(
        'SELECT * FROM fluxo_etapas WHERE fluxo_id = ? AND ordem > ? ORDER BY ordem ASC LIMIT 1'
      ).get(exec.fluxo_id, exec.etapa_atual);

      if (proxima) {
        const proximaExecucao = new Date(Date.now() + proxima.delay_segundos * 1000).toISOString();
        db.prepare(
          'UPDATE execucao_fluxo SET etapa_atual = ?, proxima_execucao = ? WHERE id = ?'
        ).run(proxima.ordem, proximaExecucao, exec.id);
      } else {
        db.prepare(
          'UPDATE execucao_fluxo SET status = ?, finalizado_em = CURRENT_TIMESTAMP WHERE id = ?'
        ).run('concluido', exec.id);
        console.log('[FLUXO] Exec #' + exec.id + ' concluida');
      }
    } catch (err) {
      console.error('[FLUXO] Erro geral exec #' + exec.id + ': ' + err.message);
    }
  }
}

async function tick() {
  if (processando) return;
  processando = true;
  try {
    await processarFila();
    await processarFluxos();
  } catch (err) {
    console.error('[WORKER] Erro:', err.message);
  } finally {
    processando = false;
  }
}

function startWorker() {
  console.log('Worker iniciado (a cada 5s)');
  intervalo = setInterval(tick, 5000);
  tick();
}

function stopWorker() {
  if (intervalo) clearInterval(intervalo);
  console.log('Worker parado');
}

module.exports = { startWorker, stopWorker };
