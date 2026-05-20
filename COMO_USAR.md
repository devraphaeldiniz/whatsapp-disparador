# Como Usar — WhatsApp Disparador

## 1. Iniciando o sistema

```bash
npm start
```

Você verá no terminal:
Migrations OK
WhatsApp: modo MOCK ativo
Worker iniciado (a cada 5s)
Servidor rodando em http://localhost:3000

Acesse no navegador: **http://localhost:3000**

---

## 2. Importando contatos

1. Crie um arquivo CSV com o seguinte formato:
nome,telefone
Joao Silva,5511999990001
Maria Souza,5511999990002
Pedro Santos,5511999990003

2. Na aba **Contatos**, clique em **Escolher ficheiro**
3. Selecione o arquivo CSV
4. Clique em **Importar**

Você verá a mensagem: `X importados, Y ignorados`

Os contatos aparecerão listados abaixo.

---

## 3. Criando e disparando uma campanha

1. Clique na aba **Campanhas**
2. Preencha os campos:
   - **Nome:** nome da campanha
   - **Mensagem:** texto que será enviado
   - **Delay mínimo:** tempo mínimo entre envios (segundos)
   - **Delay máximo:** tempo máximo entre envios (segundos)
3. Clique em **Criar Campanha**
4. Na lista de campanhas, clique em **Disparar**

O sistema irá:
- Enfileirar uma mensagem para cada contato
- Respeitar um delay aleatório entre os envios
- Processar tudo automaticamente via worker

No terminal você verá:
MOCK -> 5511999990001: Sua mensagem aqui
[FILA] Enviado #1 -> 5511999990001
MOCK -> 5511999990002: Sua mensagem aqui
[FILA] Enviado #2 -> 5511999990002

Acompanhe o status na aba **Fila**.

---

## 4. Criando um fluxo automático

1. Clique na aba **Fluxos**
2. Preencha o **Nome do fluxo**
3. Configure as etapas:

| Etapa | Mensagem | Delay |
|---|---|---|
| 1 | Ola, seja bem vindo! | 0 (imediato) |
| 2 | Aqui vai mais uma informacao | 120 (2 minutos depois) |
| 3 | Por fim, aproveite! | 300 (5 minutos depois) |

4. Use o botão **+ Etapa** para adicionar mais etapas
5. Clique em **Criar Fluxo**

---

## 5. Adicionando contatos ao fluxo

1. Na lista de fluxos, clique em **+ Adicionar lista**
2. Confirme a ação

Todos os contatos cadastrados entrarão no fluxo automaticamente.

O worker irá:
- Enviar a etapa 1 imediatamente
- Aguardar o delay configurado
- Enviar a etapa 2 automaticamente
- Repetir até concluir todas as etapas

No terminal você verá:
MOCK -> 5511999990001: Ola, seja bem vindo!
[FLUXO] Exec #1 etapa 0 -> 5511999990001
...
MOCK -> 5511999990001: Aqui vai mais uma informacao
[FLUXO] Exec #1 etapa 1 -> 5511999990001
...
[FLUXO] Exec #1 concluida

---

## 6. Acompanhando a fila

1. Clique na aba **Fila**
2. Clique em **Atualizar** para ver o status atual

Os status possíveis são:

| Status | Significado |
|---|---|
| `pendente` | Aguardando o momento do envio |
| `enviado` | Enviado com sucesso |
| `falhou` | Falhou após 3 tentativas |

---

## 7. Observações importantes

- O sistema funciona **mesmo com o navegador fechado**
- O worker verifica pendências **a cada 5 segundos**
- Se o servidor reiniciar, o worker **retoma de onde parou**
- Contatos já ativos em um fluxo **não são duplicados**
- Mensagens com erro são **reagendadas automaticamente** até 3 tentativas

---

## 8. Arquivo CSV de exemplo

Um arquivo de exemplo já está disponível na raiz do projeto:
contatos_exemplo.csv

Use-o para testar rapidamente o sistema.
