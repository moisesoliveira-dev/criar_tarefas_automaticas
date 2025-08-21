const cron = require("node-cron");
const axios = require("axios");
const { Pool } = require("pg");
require("dotenv").config();

const TIMEZONE = "America/Manaus";
let currentToken = null;

// Configuração da conexão com PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Função para testar a conexão com o banco de dados
async function testarConexaoBanco() {
  console.log("🔌 Testando conexão com o banco de dados...");

  try {
    const client = await pool.connect();

    // Teste simples: verificar a versão do PostgreSQL
    const result = await client.query("SELECT version()");
    console.log("✅ Conexão com PostgreSQL estabelecida com sucesso!");
    console.log(
      `📊 Versão do PostgreSQL: ${result.rows[0].version.split(" ")[0]} ${
        result.rows[0].version.split(" ")[1]
      }`
    );

    // Teste adicional: verificar se consegue executar queries básicas
    const testQuery = await client.query("SELECT NOW() as current_time");
    console.log(`🕒 Horário do servidor: ${testQuery.rows[0].current_time}`);

    client.release();
    return true;
  } catch (error) {
    console.error("❌ Erro ao conectar com o banco de dados:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    throw error;
  }
}

// Função para criar a tabela se não existir
async function criarTabelaSeNaoExistir() {
  console.log("📋 Verificando se tabela tb_pontta_sales_order existe...");

  try {
    const client = await pool.connect();

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS tb_pontta_sales_order (
        id SERIAL PRIMARY KEY,
        salesorderid VARCHAR(255) NOT NULL UNIQUE,
        code VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(createTableQuery);
    console.log(
      "✅ Tabela tb_pontta_sales_order verificada/criada com sucesso!"
    );

    client.release();
    return true;
  } catch (error) {
    console.error("❌ Erro ao criar/verificar tabela:", error.message);
    throw error;
  }
}

console.log("🚀 Job de tarefas automáticas iniciado!");
console.log(`📅 Agendamento: 11:00 e 15:00 (${TIMEZONE})`);

// Jobs agendados
cron.schedule(
  "0 11 * * *",
  async () => {
    console.log(`⏰ Executando job das 11:00`);
    try {
      await executarTarefas("11:00");
      console.log("✅ Job das 11:00 executado com sucesso!");
    } catch (error) {
      console.error("❌ Erro no job das 11:00:", error);
    }
  },
  { scheduled: true, timezone: TIMEZONE }
);

cron.schedule(
  "0 15 * * *",
  async () => {
    console.log(`⏰ Executando job das 15:00`);
    try {
      await executarTarefas("15:00");
      console.log("✅ Job das 15:00 executado com sucesso!");
    } catch (error) {
      console.error("❌ Erro no job das 15:00:", error);
    }
  },
  { scheduled: true, timezone: TIMEZONE }
);

// Função para verificar se uma ordem já existe no banco
async function verificarOrdemExiste(code) {
  console.log(`🔍 Verificando se ordem ${code} já existe no banco...`);

  try {
    const client = await pool.connect();
    const query = "SELECT id FROM tb_pontta_sales_order WHERE code = $1";
    const result = await client.query(query, [code]);

    client.release();

    const existe = result.rows.length > 0;
    if (existe) {
      console.log(`⚠️ Ordem ${code} já existe no banco, será ignorada`);
    } else {
      console.log(`✅ Ordem ${code} é nova, será processada`);
    }

    return existe;
  } catch (error) {
    console.error(
      `❌ Erro ao verificar ordem ${code} no banco:`,
      error.message
    );
    throw error;
  }
}

// Função para salvar ordem no banco
async function salvarOrdemNoBanco(salesOrderId, code) {
  console.log(`💾 Salvando ordem ${code} no banco...`);

  try {
    const client = await pool.connect();
    const query =
      "INSERT INTO tb_pontta_sales_order (salesorderid, code) VALUES ($1, $2) RETURNING id";
    const result = await client.query(query, [salesOrderId, code]);

    client.release();

    const novoId = result.rows[0].id;
    console.log(`✅ Ordem ${code} salva no banco com ID: ${novoId}`);

    return novoId;
  } catch (error) {
    console.error(`❌ Erro ao salvar ordem ${code} no banco:`, error.message);
    throw error;
  }
}

// Função para salvar ordem no banco
async function salvarOrdemNoBanco(salesOrderId, code) {
  console.log(`💾 Salvando ordem ${code} no banco...`);

  try {
    const client = await pool.connect();
    const query =
      "INSERT INTO tb_pontta_sales_order (salesorderid, code) VALUES ($1, $2) RETURNING id";
    const result = await client.query(query, [salesOrderId, code]);

    client.release();

    const novoId = result.rows[0].id;
    console.log(`✅ Ordem ${code} salva no banco com ID: ${novoId}`);

    return novoId;
  } catch (error) {
    console.error(`❌ Erro ao salvar ordem ${code} no banco:`, error.message);
    throw error;
  }
}

// Função para limpar ordem específica do banco (apenas para testes)
async function limparOrdemDoBanco(code) {
  console.log(`🗑️ Removendo ordem ${code} do banco para teste...`);

  try {
    const client = await pool.connect();
    const query = "DELETE FROM tb_pontta_sales_order WHERE code = $1";
    const result = await client.query(query, [code]);

    client.release();

    console.log(
      `✅ Ordem ${code} removida do banco. Linhas afetadas: ${result.rowCount}`
    );

    return result.rowCount;
  } catch (error) {
    console.error(`❌ Erro ao remover ordem ${code} do banco:`, error.message);
    throw error;
  }
}

// Função de autenticação
async function autenticarPontta() {
  console.log("🔐 Fazendo autenticação no Pontta...");

  try {
    const authData = {
      email: "moreira278@hotmail.com",
      password: "Moises25",
      rememberMe: false,
    };

    const response = await axios.post(
      "https://app.pontta.com/api/authenticate",
      authData,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (response.data && response.data.id_token) {
      currentToken = response.data.id_token;
      console.log("✅ Autenticação realizada com sucesso!");
      return currentToken;
    } else {
      throw new Error("Token não encontrado na resposta");
    }
  } catch (error) {
    console.error("❌ Erro na autenticação:", error.message);
    throw error;
  }
}

// Função para recuperar ordens
async function recuperarOrdensPedido(token) {
  console.log("📦 Recuperando ordens de pedido...");

  try {
    const start = process.env.PONTTA_START_DATE;
    const end = process.env.PONTTA_END_DATE;

    if (!start || !end) {
      throw new Error(
        "PONTTA_START_DATE e PONTTA_END_DATE devem estar no .env"
      );
    }

    console.log(`📅 Período: ${start} até ${end}`);

    const url = `https://app.pontta.com/api/sales-orders/summary?start=${start}&end=${end}`;
    console.log(`🔗 URL completa: ${url}`);

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      businessunit: process.env.PONTTA_BUSINESS_UNIT,
    };

    console.log(`🔑 Headers sendo enviados:`, {
      "Content-Type": headers["Content-Type"],
      Authorization: `Bearer ${token.substring(0, 20)}...`,
      businessunit: headers.businessunit,
    });

    const response = await axios.get(url, { headers });

    console.log(`📊 Status da resposta: ${response.status}`);
    console.log(`✅ Ordens recuperadas! Total: ${response.data?.length || 0}`);

    // Filtrar ordens que já existem no banco
    const ordensCompletas = response.data || [];
    const ordensNovas = [];

    if (ordensCompletas.length > 0) {
      console.log("🔍 Verificando quais ordens são novas...");

      for (const ordem of ordensCompletas) {
        const jaExiste = await verificarOrdemExiste(ordem.code);
        if (!jaExiste) {
          ordensNovas.push(ordem);
        }
      }

      console.log(`📊 Total original: ${ordensCompletas.length}`);
      console.log(`📊 Ordens novas para processar: ${ordensNovas.length}`);
      console.log(
        `📊 Ordens ignoradas (já existem): ${
          ordensCompletas.length - ordensNovas.length
        }`
      );
    }

    // Log detalhado dos dados retornados (apenas ordens novas)
    if (ordensNovas.length > 0) {
      console.log(
        `📋 Códigos das ordens novas:`,
        ordensNovas.map((ordem) => ordem.code)
      );
      console.log(
        `📋 Datas de venda das ordens novas:`,
        ordensNovas.map((ordem) => `${ordem.code}: ${ordem.saleDate}`)
      );
    } else {
      console.log(`📋 Nenhuma ordem nova para processar`);
    }

    return ordensNovas;
  } catch (error) {
    console.error("❌ Erro ao recuperar ordens:", error.message);
    throw error;
  }
}

// Função para buscar detalhes de uma ordem
async function buscarDetalhesOrdem(token, code) {
  console.log(`🔍 Buscando detalhes da ordem: ${code}`);

  try {
    const url = `https://app.pontta.com/api/sales-orders?code=${code}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      businessunit: process.env.PONTTA_BUSINESS_UNIT,
    };

    const response = await axios.get(url, { headers });
    const detalhes = response.data;
    const quantidade = Array.isArray(detalhes)
      ? detalhes.length
      : detalhes
      ? 1
      : 0;

    console.log(
      `✅ Detalhes da ordem ${code} recuperados! Objetos: ${quantidade}`
    );
    return detalhes;
  } catch (error) {
    console.error(
      `❌ Erro ao buscar detalhes da ordem ${code}:`,
      error.message
    );
    throw error;
  }
}

// Função para processar todas as ordens
async function processarDetalhesOrdens(token, ordens) {
  console.log(`📋 Processando detalhes de ${ordens.length} ordens...`);

  const detalhesCompletos = [];

  for (let i = 0; i < ordens.length; i++) {
    const ordem = ordens[i];
    console.log(`🔄 ${i + 1}/${ordens.length}: ${ordem.code}`);

    try {
      const detalhes = await buscarDetalhesOrdem(token, ordem.code);

      if (Array.isArray(detalhes)) {
        detalhesCompletos.push(...detalhes);
      } else if (detalhes) {
        detalhesCompletos.push(detalhes);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`⚠️ Erro ao processar ${ordem.code}, continuando...`);
    }
  }

  console.log(`✅ Total de detalhes coletados: ${detalhesCompletos.length}`);
  return detalhesCompletos;
}

// Função para verificar se é dia útil (seg-sex)
function isDiaUtil(data) {
  const diaSemana = data.getDay();
  return diaSemana >= 1 && diaSemana <= 5; // 1=segunda, 5=sexta
}

// Função para adicionar dias úteis a uma data
function adicionarDiasUteis(dataInicial, diasUteis) {
  const resultado = new Date(dataInicial);
  let diasAdicionados = 0;

  while (diasAdicionados < diasUteis) {
    resultado.setDate(resultado.getDate() + 1);
    if (isDiaUtil(resultado)) {
      diasAdicionados++;
    }
  }

  // Definir para o final do dia (23:59) no timezone de Manaus (UTC-4)
  // Para que seja 23:59 em Manaus, precisa ser 03:59 UTC no dia seguinte
  resultado.setUTCHours(3, 59, 59, 999);

  return resultado;
}

// Função para calcular data de checagem de medida (apenas seg, qua, sex - 2 dias após venda mínimo)
function calcularDataChecagemMedida(dataVenda, diasMinimos) {
  const dataVendaObj = new Date(dataVenda);
  const hoje = new Date();

  // Verificar se a data de venda é hoje (comparar apenas a data, ignorar horário)
  const dataVendaSoData = new Date(
    dataVendaObj.getFullYear(),
    dataVendaObj.getMonth(),
    dataVendaObj.getDate()
  );
  const hojeSoData = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate()
  );
  const isDataVendaHoje = dataVendaSoData.getTime() === hojeSoData.getTime();

  let diasParaAdicionar = diasMinimos;
  if (isDataVendaHoje) {
    diasParaAdicionar += 1; // Adiciona 1 dia extra se for hoje
    console.log(
      `🆕 Pedido de venda é de hoje! Adicionando 1 dia extra. Total: ${diasParaAdicionar} dias úteis`
    );
  }

  const dataMinima = adicionarDiasUteis(dataVendaObj, diasParaAdicionar);

  // Verificar se a data mínima cai em seg, qua ou sex
  const diaSemana = dataMinima.getDay();

  if (diaSemana === 1 || diaSemana === 3 || diaSemana === 5) {
    // Já é seg, qua ou sex - manter a data
    dataMinima.setUTCHours(3, 59, 59, 999); // 23:59 em Manaus
    return dataMinima;
  } else if (diaSemana === 2) {
    // Terça -> próxima quarta
    dataMinima.setDate(dataMinima.getDate() + 1);
    dataMinima.setUTCHours(3, 59, 59, 999);
    return dataMinima;
  } else if (diaSemana === 4) {
    // Quinta -> próxima sexta
    dataMinima.setDate(dataMinima.getDate() + 1);
    dataMinima.setUTCHours(3, 59, 59, 999);
    return dataMinima;
  } else {
    // Sábado ou domingo -> próxima segunda
    while (!isDiaUtil(dataMinima) || ![1, 3, 5].includes(dataMinima.getDay())) {
      dataMinima.setDate(dataMinima.getDate() + 1);
    }
    dataMinima.setUTCHours(3, 59, 59, 999);
    return dataMinima;
  }
}

// Função para criar uma task
async function criarTask(token, ordemId, taskData) {
  console.log(`🔨 Criando task: ${taskData.title}`);

  try {
    const url = `https://app.pontta.com/api/tasks/SALES_ORDER/${ordemId}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      businessunit: process.env.PONTTA_BUSINESS_UNIT,
    };

    console.log(`🔗 URL da task: ${url}`);
    console.log(`📅 Deadline: ${taskData.deadline}`);

    // Converter para timezone de Manaus para log
    const deadlineManaus = new Date(taskData.deadline);
    const manausTime = deadlineManaus.toLocaleString("pt-BR", {
      timeZone: "America/Manaus",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log(`🕒 Horário em Manaus: ${manausTime}`);

    const taskPayload = {
      id: null,
      title: taskData.title,
      responsible: process.env.TASK_RESPONSIBLE_ID,
      comment: null,
      alert: null,
      deadline: taskData.deadline,
      time: null,
      type: "OTHER",
      workflowPositionId: null,
      note: null,
    };

    const response = await axios.post(url, taskPayload, { headers });

    console.log(`✅ Task criada com sucesso! Status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erro ao criar task "${taskData.title}":`, error.message);
    throw error;
  }
}

// Função para processar ambientes e criar tasks
async function processarAmbientesECriarTasks(token, detalhesOrdens) {
  console.log(`🏠 Processando ambientes e criando tasks...`);

  const resultadosTasks = [];

  for (const ordem of detalhesOrdens) {
    console.log(`🔄 Processando ordem ${ordem.code} (ID: ${ordem.id})`);
    console.log(`📅 Data de venda: ${ordem.saleDate}`);

    // Extrair ambientes (names) do array items do primeiro nível
    const ambientes = [];
    if (ordem.items && Array.isArray(ordem.items)) {
      ordem.items.forEach((item) => {
        if (item.name) {
          ambientes.push(item.name);
        }
      });
    }

    console.log(`🏠 Ambientes encontrados na ordem ${ordem.code}:`, ambientes);

    // Para cada ambiente, criar 4 tasks
    for (const ambiente of ambientes) {
      console.log(`🔨 Criando 4 tasks para o ambiente: "${ambiente}"`);

      try {
        // Calcular datas baseadas na regra de negócio
        const diasChecagem =
          parseInt(process.env.TASK_DIAS_CHECAGEM_MEDIDA) || 2;
        const diasRevisao =
          parseInt(process.env.TASK_DIAS_REVISAO_PROJETO) || 2;
        const diasEnvio = parseInt(process.env.TASK_DIAS_ENVIO_CLIENTE) || 2;
        const diasAprovacao =
          parseInt(process.env.TASK_DIAS_APROVACAO_EXECUTIVO) || 2;

        // Task 1: Checagem de medida (apenas seg, qua, sex - 2 dias após venda mínimo)
        const dataChecagem = calcularDataChecagemMedida(
          ordem.saleDate,
          diasChecagem
        );
        const task1 = await criarTask(token, ordem.id, {
          title: `01. ${ambiente} Checagem de medida`,
          deadline: dataChecagem.toISOString(),
        });

        // Task 2: Revisão do Projeto (2 dias úteis após checagem)
        const dataRevisao = adicionarDiasUteis(dataChecagem, diasRevisao);
        const task2 = await criarTask(token, ordem.id, {
          title: `01. ${ambiente} Revisão do Projeto`,
          deadline: dataRevisao.toISOString(),
        });

        // Task 3: Envio para o Cliente (2 dias úteis após revisão)
        const dataEnvio = adicionarDiasUteis(dataRevisao, diasEnvio);
        const task3 = await criarTask(token, ordem.id, {
          title: `01. ${ambiente} Envio para o Cliente`,
          deadline: dataEnvio.toISOString(),
        });

        // Task 4: Aprovação do Projeto Executivo (2 dias úteis após envio)
        const dataAprovacao = adicionarDiasUteis(dataEnvio, diasAprovacao);
        const task4 = await criarTask(token, ordem.id, {
          title: `01. ${ambiente} Aprovação do Projeto Executivo`,
          deadline: dataAprovacao.toISOString(),
        });

        resultadosTasks.push({
          ordem: ordem.code,
          ordemId: ordem.id,
          ambiente: ambiente,
          dataVenda: ordem.saleDate,
          tasks: [
            { tipo: "checagem", data: dataChecagem.toISOString(), task: task1 },
            { tipo: "revisao", data: dataRevisao.toISOString(), task: task2 },
            { tipo: "envio", data: dataEnvio.toISOString(), task: task3 },
            {
              tipo: "aprovacao",
              data: dataAprovacao.toISOString(),
              task: task4,
            },
          ],
        });

        console.log(
          `✅ 4 tasks criadas para "${ambiente}" na ordem ${ordem.code}:`
        );
        console.log(
          `   📅 Checagem: ${dataChecagem.toLocaleDateString("pt-BR")}`
        );
        console.log(
          `   📅 Revisão: ${dataRevisao.toLocaleDateString("pt-BR")}`
        );
        console.log(`   📅 Envio: ${dataEnvio.toLocaleDateString("pt-BR")}`);
        console.log(
          `   📅 Aprovação: ${dataAprovacao.toLocaleDateString("pt-BR")}`
        );

        // Pequeno delay entre ambientes
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(
          `⚠️ Erro ao criar tasks para ambiente "${ambiente}" na ordem ${ordem.code}:`,
          error.message
        );
      }
    }

    // Se chegou até aqui, todas as tasks foram criadas com sucesso
    // Salvar a ordem no banco para não processar novamente
    try {
      await salvarOrdemNoBanco(ordem.id, ordem.code);
      console.log(
        `✅ Ordem ${ordem.code} salva no banco após criação das tasks`
      );
    } catch (error) {
      console.error(
        `⚠️ Erro ao salvar ordem ${ordem.code} no banco:`,
        error.message
      );
      // Não interrompe o processo, apenas loga o erro
    }

    // Delay entre ordens
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(
    `✅ Processamento de ambientes concluído! Total de conjuntos de tasks: ${resultadosTasks.length}`
  );
  return resultadosTasks;
}

// Função principal
async function executarTarefas(horario) {
  console.log(`📋 Iniciando execução (${horario})...`);

  try {
    console.log("🔄 Etapa 0: Testando conexão com banco...");
    await testarConexaoBanco();
    await criarTabelaSeNaoExistir();
    console.log("✓ Etapa 0: Conexão com banco OK");

    console.log("🔄 Etapa 1: Autenticação...");
    const token = await autenticarPontta();
    console.log("✓ Etapa 1: Concluída");

    console.log("🔄 Etapa 2: Recuperando ordens...");
    const ordens = await recuperarOrdensPedido(token);
    console.log("✓ Etapa 2: Concluída");

    console.log("🔄 Etapa 3: Buscando detalhes...");
    const detalhes = await processarDetalhesOrdens(token, ordens);
    console.log("✓ Etapa 3: Concluída");

    console.log("� Etapa 4: Processando ambientes e criando tasks...");
    const resultadosTasks = await processarAmbientesECriarTasks(
      token,
      detalhes
    );
    console.log("✓ Etapa 4: Concluída");

    console.log("�📋 Próximas etapas aguardando implementação...");

    return {
      success: true,
      ordens: ordens,
      detalhes: detalhes,
      tasks: resultadosTasks,
      totalOrdens: ordens.length,
      totalDetalhes: detalhes.length,
      totalTasks: resultadosTasks.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Erro na execução:", error.message);
    throw error;
  }
}

console.log("🔄 Jobs agendados!");
console.log("💡 Pressione Ctrl+C para encerrar");

// Teste
if (process.argv.includes("teste")) {
  console.log("🧪 MODO TESTE ATIVADO");

  // Limpar uma ordem específica para testar
  (async () => {
    try {
      const client = await pool.connect();
      await client.query(
        "DELETE FROM tb_pontta_sales_order WHERE code = 'PV-CM-510'"
      );
      client.release();
      console.log("🗑️ Ordem PV-CM-510 removida para teste");
    } catch (error) {
      console.log("⚠️ Erro ao limpar banco (normal se não existir)");
    }
  })();

  executarTarefas("teste")
    .then((result) => {
      console.log("✅ Teste concluído");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Erro no teste:", error.message);
      process.exit(1);
    });
}
