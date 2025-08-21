const cron = require("node-cron");
const {
  testarConexaoBanco,
  criarTabelaSeNaoExistir,
  criarTabelaRodizioSeNaoExistir,
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

// Função principal
async function executarTarefas(horario) {
  console.log(`📋 Iniciando execução (${horario})...`);

  try {
    console.log("🔄 Etapa 0: Testando conexão com banco...");
    await testarConexaoBanco();
    await criarTabelaSeNaoExistir();
    await criarTabelaRodizioSeNaoExistir();
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
