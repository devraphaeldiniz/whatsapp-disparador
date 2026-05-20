# WhatsApp Disparador

Sistema web para gerenciamento de contatos e envio automático de mensagens via WhatsApp, com suporte a campanhas simples e fluxos de mensagens sequenciais.

## Tecnologias

- **Node.js** + **Express 4** — servidor HTTP e API REST
- **better-sqlite3** — banco de dados SQLite com persistência
- **WPPConnect** — integração com WhatsApp (modo mock por padrão)
- **Multer** + **csv-parse** — importação de contatos via CSV
- **Worker próprio** — agendador interno com setInterval, independente do navegador

## Como rodar

### Requisitos
- Node.js 18+
- npm

### Instalação

```bash
git clone https://github.com/devraphaeldiniz/whatsapp-disparador.git
cd whatsapp-disparador
npm install
```

### Configuração

O arquivo `.env` já vem configurado para modo mock:
PORT=3000
WHATSAPP_MOCK=true

Para usar o WhatsApp real, instale o WPPConnect e altere para `WHATSAPP_MOCK=false`:

```bash
npm install @wppconnect-team/wppconnect
```

### Executar

```bash
npm start
```

Acesse: http://localhost:3000

## Arquitetura
src/
├── database/
│   ├── db.js            # Conexão SQLite singleton
│   └── migrations.js    # Criação das tabelas
├── routes/
│   ├── contacts.js      # Importação e listagem de contatos
│   ├── campaigns.js     # Criação e disparo de campanhas
│   ├── flows.js         # Criação e execução de fluxos
│   └── whatsapp.js      # Status e QR code
├── services/
│   ├── whatsapp.js      # Integração WPPConnect (real ou mock)
│   └── queueService.js  # Manipulação da fila de envio
├── workers/
│   └── messageWorker.js # Worker contínuo de processamento
├── app.js               # Configuração do Express
└── server.js            # Entry point
public/
└── index.html           # Frontend single page
data/
└── database.sqlite      # Banco gerado automaticamente

## Banco de dados

| Tabela | Descrição |
|---|---|
| `contatos` | Contatos importados via CSV |
| `campanhas` | Campanhas de disparo simples |
| `fila_envio` | Fila persistida de mensagens agendadas |
| `fluxos` | Fluxos de mensagens sequenciais |
| `fluxo_etapas` | Etapas de cada fluxo com delay |
| `execucao_fluxo` | Execução individual por contato |

## Decisões técnicas

### Fila persistida no banco
Os envios nunca ocorrem diretamente no controller HTTP. Ao disparar uma campanha, o controller apenas insere registros na tabela `fila_envio` com o campo `agendado_para` calculado com delay aleatório acumulado. O worker é quem busca e processa esses registros.

### Worker independente do navegador
O `messageWorker.js` roda um `setInterval` de 5 segundos que verifica dois tipos de pendências:
- Mensagens da fila com `agendado_para <= agora`
- Execuções de fluxo com `proxima_execucao <= agora`

Toda a lógica de quando enviar está persistida no banco, não na memória. Se o servidor reiniciar, o worker retoma de onde parou.

### Fluxos por contato
Cada contato tem sua própria linha em `execucao_fluxo` com os campos `etapa_atual` e `proxima_execucao`. Isso garante execução totalmente independente — um contato não depende do andamento de outro.

### Temporização
O controle de tempo é feito por datas armazenadas no banco (`agendado_para`, `proxima_execucao`), não por `setTimeout` encadeado. Isso atende a regra de não depender de memória volátil para controlar os envios.

## Funcionalidades

- **Importação de contatos** via CSV com colunas `nome` e `telefone`
- **Campanhas de disparo** com delay mínimo e máximo aleatório entre envios
- **Fluxos automáticos** com etapas sequenciais e delays configuráveis
- **Adicionar lista ao fluxo** — todos os contatos entram no fluxo automaticamente
- **Fila de envio** com controle de status: pendente, enviado, falhou
- **Retry automático** — mensagens com erro são reagendadas até 3 tentativas
- **Modo mock** para desenvolvimento sem precisar conectar WhatsApp real
