# 🚀 Sistema de Tarefas Automáticas - Pontta

Sistema automatizado que integra com a API do Pontta para criar tasks no sistema baseado em pedidos de venda, executando em horários programados.

## ⏰ Horários de Execução

- **11:00** - Processamento diário
- **15:00** - Processamento diário  
- **23:59** - Processamento diário
- **A cada 10 minutos** - Apenas em desenvolvimento

## 🚀 Deploy no Railway

### 1. Conectar Repositório
1. Acesse [Railway.app](https://railway.app/)
2. Faça login com GitHub
3. Clique em "New Project" 
4. Selecione "Deploy from GitHub repo"
5. Escolha este repositório: `moisesoliveira-dev/criar_tarefas_automaticas`

### 2. Configurar Variáveis de Ambiente
No Railway, vá em **Variables** e adicione:

```bash
# Horários dos Jobs (não mudar, já configurado)
JOB_SCHEDULE_11H=0 11 * * *
JOB_SCHEDULE_15H=0 15 * * *
JOB_SCHEDULE_23H59=59 23 * * *
JOB_SCHEDULE_TEST=*/10 * * * *

# Pontta Business Unit (não mudar)
PONTTA_BUSINESS_UNIT=d6e8a1cd-ab55-4dd2-96cd-dbab38f75f2e

# Configurações das Tasks (pode ajustar os dias)
TASK_DIAS_CHECAGEM_MEDIDA=2
TASK_DIAS_REVISAO_PROJETO=2
TASK_DIAS_ENVIO_CLIENTE=2
TASK_DIAS_APROVACAO_EXECUTIVO=2

# ID do responsável (pode mudar conforme necessário)
TASK_RESPONSIBLE_ID=c02ae491-57f1-445d-965c-3fa26d9dad7d

# PostgreSQL - Railway vai gerar automaticamente, mas configure se necessário
DATABASE_PUBLIC_URL=postgresql://user:pass@host:port/db

# Ambiente (marcar como production no Railway)
NODE_ENV=production
```

### 3. Deploy Automático
O Railway detectará o arquivo `railway.json` e fará o deploy automaticamente.

## 🎯 Como Funciona

1. **Cron Jobs** executam nos horários: 11:00, 15:00 e 23:59
2. **API Pontta** é consultada para pedidos do dia atual (sempre hoje)  
3. **Sistema de rodízio** distribui ambientes entre projetistas
4. **Numeração sequencial** (01, 02, 03...) por ambiente
5. **4 tasks por ambiente** com o mesmo responsável
6. **Prevenção de duplicação** via banco PostgreSQL

## � Estrutura de Tasks por Ambiente

Cada ambiente gera 4 tasks para o mesmo projetista:

**Ambiente 01 - Cozinha (Projetista A):**
- `01 - Cozinha Checagem de medida`
- `01 - Cozinha Revisão do Projeto`  
- `01 - Cozinha Envio para o Cliente`
- `01 - Cozinha Aprovação do Projeto Executivo`

**Ambiente 02 - Sala (Projetista B):**
- `02 - Sala Checagem de medida`
- `02 - Sala Revisão do Projeto`
- `02 - Sala Envio para o Cliente` 
- `02 - Sala Aprovação do Projeto Executivo`

## 🔄 Sistema de Rodízio

- **1 pessoa por ambiente completo** (todas as 4 tasks)
- **Rodízio entre ambientes** (Mayra → Luna → Vitor → Anna)
- **Persistência do estado** no PostgreSQL

## 🧪 Teste Local

```bash
# Testar o sistema
npm run test

# Ver logs detalhados
npm start
```

## 📊 Funcionalidades Implementadas

✅ **Integração com API Pontta**  
✅ **Sistema de rodízio de projetistas**  
✅ **Numeração sequencial por ambiente**  
✅ **Data dinâmica** (sempre o dia atual)  
✅ **Cálculos de data com regras de negócio**  
✅ **Persistência em PostgreSQL**  
✅ **Timezone Manaus (UTC-4)**  
✅ **Prevenção de duplicações**  
✅ **3 horários diários de execução**

## 📅 Agendamento

O projeto usa `node-cron` para agendar as execuções:
- **11:00 (Manaus/AM)**: Execução matinal
- **15:00 (Manaus/AM)**: Execução vespertina

## 🔧 Próximos Passos

1. Implemente as etapas específicas na função `executarTarefas()`
2. Configure as variáveis de ambiente necessárias
3. Teste localmente antes do deploy
4. Faça o deploy no Railway
