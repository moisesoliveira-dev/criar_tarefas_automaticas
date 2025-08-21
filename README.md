# Job de Tarefas Automáticas

Este projeto é um job automatizado que executa diariamente às **11:00** e **15:00** no horário de **Manaus/AM (UTC-4)**.

## 🚀 Deploy no Railway

1. Conecte seu repositório GitHub ao Railway
2. Configure as variáveis de ambiente necessárias
3. O Railway detectará automaticamente o `package.json` e fará o deploy

## ⚙️ Configuração

### Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e configure as variáveis necessárias:

```bash
cp .env.example .env
```

### Instalação Local
```bash
npm install
```

### Execução Local
```bash
npm start
```

## 📋 Funcionalidades

- ⏰ Execução automática às 11:00 e 15:00 (horário de Manaus/AM)
- 🌍 Configuração correta de timezone
- 📝 Logs detalhados de execução
- 🔄 Estrutura modular para implementação das etapas
- ☁️ Pronto para deploy no Railway

## 🛠️ Estrutura do Projeto

```
criar_tarefas_automaticas/
├── index.js          # Arquivo principal com os jobs agendados
├── package.json      # Dependências e scripts
├── .env.example      # Exemplo de variáveis de ambiente
├── .gitignore        # Arquivos ignorados pelo Git
└── README.md         # Este arquivo
```

## 📅 Agendamento

O projeto usa `node-cron` para agendar as execuções:
- **11:00 (Manaus/AM)**: Execução matinal
- **15:00 (Manaus/AM)**: Execução vespertina

## 🔧 Próximos Passos

1. Implemente as etapas específicas na função `executarTarefas()`
2. Configure as variáveis de ambiente necessárias
3. Teste localmente antes do deploy
4. Faça o deploy no Railway
