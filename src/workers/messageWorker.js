const { buscarPendentes, marcarComoEnviado, marcarComoErro } = require('../services/queueService');
const { sendMessage } = require('../services/whatsapp');
const { getDb } = require('../database/db');

let intervalo = null;   // referência do setInterval para poder parar o worker
let processando = false; // flag que evita execuções simultâneas do tick

// ─── FILA DE CAMPANHAS ────────────────────────────────────────────────────────
// Busca mensagens pendentes cujo horário chegou e tenta enviá-las
// Processa no máximo 5 por ciclo para não sobrecarregar o WhatsApp
async function processarFila() {
  const itens = buscarPendentes(5);

  for (const item of itens) {
    try {
      // Envia via WhatsApp (real ou mock)
      await sendMessage(item.telefone, item.mensagem);

      // Marca como enviado no banco — persiste o resultado
      marcarComoEnviado(item.id);
      console.log('[FILA] Enviado #' + item.id + ' -> ' + item.telefone);
    } catch (err) {
      // Em caso de falha, incrementa tentativas e reagenda ou marca como falhou
      marcarComoErro(item.id, err.message, item.tentativas);
      console.error('[FILA] Erro #' + item.id + ': ' + err.message);
    }
  }

  // Após processar a fila, verifica se alguma campanha foi concluída
  verificarCampanhasConcluidas();
}

// Verifica campanhas em status "disparando" que não têm mais pendentes
// Atualiza o status para "concluido" automaticamente
function verificarCampanhasConcluidas() {
  const db = getDb();
  const campanhas = db.prepare(
    "SELECT id FROM campanhas WHERE status = 'disparando'"
  ).all();

  for (const c of campanhas) {
    const pendentes = db.prepare(
      "SELECT COUNT(*) as total FROM fila_envio WHERE campanha_id = ? AND status = 'pendente'"
    ).get(c.id);

    if (pendentes.total === 0) {
      db.prepare("UPDATE campanhas SET status = 'concluido' WHERE id = ?").run(c.id);
      console.log('[CAMPANHA] Campanha #' + c.id + ' concluida');
    }
  }
}

// ─── FLUXOS AUTOMÁTICOS ───────────────────────────────────────────────────────
// Busca execuções ativas cujo horário da próxima etapa já chegou
// Cada contato tem sua própria linha em execucao_fluxo — independência total
async function processarFluxos() {
  const db = getDb();

  // Busca até 20 execuções vencidas por ciclo
  const execucoes = db.prepare(
    'SELECT ef.*, c.telefone, c.nome FROM execucao_fluxo ef JOIN contatos c ON c.id = ef.contato_id WHERE ef.status = ? AND ef.proxima_execucao <= ? LIMIT 20'
  ).all('ativo', new Date().toISOString());

  for (const exec of execucoes) {
    try {
      await processarEtapa(exec);
    } catch (err) {
      console.error('[FLUXO] Erro geral exec #' + exec.id + ': ' + err.message);
    }
  }
}

// Processa uma etapa individual de uma execução de fluxo
async function processarEtapa(exec) {
  const db = getDb();

  // Busca a etapa atual pelo fluxo e pela ordem armazenada em execucao_fluxo
  const etapa = db.prepare(
    'SELECT * FROM fluxo_etapas WHERE fluxo_id = ? AND ordem = ?'
  ).get(exec.fluxo_id, exec.etapa_atual);

  // Se não encontrou etapa, o fluxo chegou ao fim — marca como concluido
  if (!etapa) {
    db.prepare(
      'UPDATE execucao_fluxo SET status = ?, finalizado_em = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('concluido', exec.id);
    console.log('[FLUXO] Exec #' + exec.id + ' concluida');
    return;
  }

  // Tenta enviar a mensagem da etapa atual
  try {
    await sendMessage(exec.telefone, etapa.mensagem);
    console.log('[FLUXO] Exec #' + exec.id + ' etapa ' + exec.etapa_atual + ' -> ' + exec.telefone);
  } catch (err) {
    // Loga o erro mas continua — não trava o fluxo por falha de envio
    console.error('[FLUXO] Erro ao enviar exec #' + exec.id + ': ' + err.message);
  }

  // Busca a próxima etapa do fluxo (ordem maior que a atual)
  const proxima = db.prepare(
    'SELECT * FROM fluxo_etapas WHERE fluxo_id = ? AND ordem > ? ORDER BY ordem ASC LIMIT 1'
  ).get(exec.fluxo_id, exec.etapa_atual);

  if (proxima) {
    // Calcula quando a próxima etapa deve ser executada com base no delay configurado
    const proximaExecucao = new Date(Date.now() + proxima.delay_segundos * 1000).toISOString();

    // Avança a execução para a próxima etapa — persiste no banco
    db.prepare(
      'UPDATE execucao_fluxo SET etapa_atual = ?, proxima_execucao = ? WHERE id = ?'
    ).run(proxima.ordem, proximaExecucao, exec.id);
  } else {
    // Não há próxima etapa — fluxo concluído para este contato
    db.prepare(
      'UPDATE execucao_fluxo SET status = ?, finalizado_em = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('concluido', exec.id);
    console.log('[FLUXO] Exec #' + exec.id + ' concluida');
  }
}

// ─── LOOP PRINCIPAL ───────────────────────────────────────────────────────────
// Executado a cada 5 segundos pelo setInterval
// A flag "processando" evita que dois ciclos rodem ao mesmo tempo
async function tick() {
  if (processando) return;
  processando = true;

  try {
    await processarFila();
    await processarFluxos();
  } catch (err) {
    console.error('[WORKER] Erro:', err.message);
  } finally {
    // Garante que a flag seja liberada mesmo em caso de erro
    processando = false;
  }
}

// Inicia o worker — chamado uma vez no server.js ao subir o servidor
// Executa imediatamente e depois a cada 5 segundos continuamente
function startWorker() {
  console.log('Worker iniciado (a cada 5s)');
  intervalo = setInterval(tick, 5000);
  tick(); // primeira execução imediata sem esperar 5s
}

// Para o worker — útil para testes ou desligamento controlado
function stopWorker() {
  if (intervalo) clearInterval(intervalo);
  console.log('Worker parado');
}

module.exports = { startWorker, stopWorker };
