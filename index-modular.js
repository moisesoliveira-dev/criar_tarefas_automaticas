const cron = require("node-cron");
const {
  testarConexaoBanco,
  criarTabelaSeNaoExistir,
  criarTabelaRodizioSeNaoExistir,
  criarTabelaAgendamentosSeNaoExistir,
  configurarRodizioVitorInicial,
  pool,
} = require("./src/database");
const {
  autenticarPontta,
  recuperarOrdensPedido,
  processarDetalhesOrdens,
} = require("./src/pontta-api");
const { processarAmbientesECriarTasks } = require("./src/tasks");
require("dotenv").config();

const TIMEZONE = "America/Manaus";

// Verificar se os jobs estão habilitados
const jobsEnabled = process.env.JOBS_ENABLED !== "false";
console.log(`🔘 Jobs: ${jobsEnabled ? "HABILITADOS" : "DESABILITADOS"}`);

if (!jobsEnabled) {
  console.log(
    "⏸️ JOBS PAUSADOS - Para reativar, remova JOBS_ENABLED=false ou mude para JOBS_ENABLED=true"
  );
  console.log(
    "💡 Sistema permanecerá rodando, mas não executará as tarefas automáticas"
  );
} else {
  console.log(
    "▶️ JOBS ATIVOS - Sistema executará as tarefas automáticas conforme agendado"
  );
}

console.log("🚀 Job de tarefas automáticas iniciado!");
console.log(`📅 Agendamentos configurados:`);
console.log(`   • 11:00 (${TIMEZONE})`);
console.log(`   • 15:00 (${TIMEZONE})`);
console.log(`   • 23:59 (${TIMEZONE})`);
console.log(`   • Teste: a cada 1 minuto`);

// Verificar se job de teste deve ser ativado
const testScheduleVar = process.env.JOB_SCHEDULE_TEST;
console.log(
  `🔍 Debug JOB_SCHEDULE_TEST: "${testScheduleVar}" (tipo: ${typeof testScheduleVar})`
);
const shouldRunTestJob = testScheduleVar && testScheduleVar !== "";
console.log(`🧪 Job de teste: ${shouldRunTestJob ? "ATIVADO" : "DESATIVADO"}`);
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || "undefined"}`);

// Job das 11:00
cron.schedule(
  process.env.JOB_SCHEDULE_11H || "0 11 * * *",
  async () => {
    console.log(`⏰ Executando job das 11:00`);
    try {
      await executarTarefasSeHabilitado("11:00");
      console.log("✅ Job das 11:00 executado com sucesso!");
    } catch (error) {
      console.error("❌ Erro no job das 11:00:", error);
    }
  },
  { scheduled: true, timezone: TIMEZONE }
);

// Job das 15:00
cron.schedule(
  process.env.JOB_SCHEDULE_15H || "0 15 * * *",
  async () => {
    console.log(`⏰ Executando job das 15:00`);
    try {
      await executarTarefasSeHabilitado("15:00");
      console.log("✅ Job das 15:00 executado com sucesso!");
    } catch (error) {
      console.error("❌ Erro no job das 15:00:", error);
    }
  },
  { scheduled: true, timezone: TIMEZONE }
);

// Job das 23:59
cron.schedule(
  process.env.JOB_SCHEDULE_23H59 || "59 23 * * *",
  async () => {
    console.log(`⏰ Executando job das 23:59`);
    try {
      await executarTarefasSeHabilitado("23:59");
      console.log("✅ Job das 23:59 executado com sucesso!");
    } catch (error) {
      console.error("❌ Erro no job das 23:59:", error);
    }
  },
  { scheduled: true, timezone: TIMEZONE }
);

// Job de teste - ativado se JOB_SCHEDULE_TEST estiver definido
const testSchedule = process.env.JOB_SCHEDULE_TEST;
if (shouldRunTestJob && testSchedule && testSchedule.trim() !== "") {
  console.log(`🧪 Agendando job de teste: ${testSchedule}`);
  console.log(
    `🕒 Horário atual: ${new Date().toLocaleString("pt-BR", {
      timeZone: TIMEZONE,
    })}`
  );

  cron.schedule(
    testSchedule,
    async () => {
      console.log(`🧪 Executando job de teste (${testSchedule})`);
      console.log(
        `🕒 Horário de execução: ${new Date().toLocaleString("pt-BR", {
          timeZone: TIMEZONE,
        })}`
      );
      try {
        await executarTarefasSeHabilitado("teste-automatico");
        console.log("✅ Job de teste executado com sucesso!");
      } catch (error) {
        console.error("❌ Erro no job de teste:", error);
      }
    },
    { scheduled: true, timezone: TIMEZONE }
  );
} else {
  console.log(
    "⚪ Job de teste não configurado (JOB_SCHEDULE_TEST não definido)"
  );
}

// Função wrapper que verifica se os jobs estão habilitados
async function executarTarefasSeHabilitado(horario) {
  // Verificar novamente no momento da execução (permite mudança dinâmica)
  const jobsEnabledAgora = process.env.JOBS_ENABLED !== "false";

  if (!jobsEnabledAgora) {
    console.log(
      `⏸️ Job ${horario} PULADO - Jobs estão desabilitados (JOBS_ENABLED=false)`
    );
    console.log(
      "💡 Para reativar: remova JOBS_ENABLED ou defina JOBS_ENABLED=true"
    );
    return;
  }

  console.log(`▶️ Job ${horario} EXECUTANDO - Jobs estão habilitados`);
  await executarTarefas(horario);
}

// Função principal
async function executarTarefas(horario) {
  console.log(`📋 Iniciando execução (${horario})...`);

  try {
    console.log("🔄 Etapa 0: Testando conexão com banco...");
    await testarConexaoBanco();
    await criarTabelaSeNaoExistir();
    await criarTabelaRodizioSeNaoExistir();
    await criarTabelaAgendamentosSeNaoExistir();
    await configurarRodizioVitorInicial();
    console.log("✓ Etapa 0: Conexão com banco e criação de tabelas OK");

    console.log("🔄 Etapa 1: Autenticação...");
    const token = await autenticarPontta();
    console.log("✓ Etapa 1: Concluída");

    console.log("🔄 Etapa 2: Recuperando ordens...");
    const ordens = await recuperarOrdensPedido(token);
    console.log("✓ Etapa 2: Concluída");

    console.log("🔄 Etapa 3: Buscando detalhes...");
    const detalhes = await processarDetalhesOrdens(token, ordens);
    console.log("✓ Etapa 3: Concluída");

    console.log("🔄 Etapa 4: Processando ambientes e criando tasks...");
    const resultadosTasks = await processarAmbientesECriarTasks(
      token,
      detalhes
    );
    console.log("✓ Etapa 4: Concluída");

    console.log("📋 Próximas etapas aguardando implementação...");

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
