const axios = require("axios");
const {
  salvarOrdemNoBanco,
  obterProximoProjetista,
  passarRodizioParaProximo,
} = require("./database");
const {
  calcularDataChecagemMedida,
  adicionarDiasUteis,
} = require("./date-utils");
require("dotenv").config();

// Função para criar uma task
async function criarTask(token, ordemId, taskData, numeroAmbiente, projetista) {
  console.log(
    `🔨 Criando task ${numeroAmbiente.toString().padStart(2, "0")}: ${
      taskData.title
    }`
  );

  try {
    console.log(
      `👤 Projetista responsável: ${projetista.name} (${projetista.projetistaid})`
    );

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
      title: `${numeroAmbiente.toString().padStart(2, "0")} - ${
        taskData.title
      }`,
      responsible: projetista.projetistaid,
      comment: null,
      alert: null,
      deadline: taskData.deadline,
      time: null,
      type: "OTHER",
      workflowPositionId: null,
      note: null,
    };

    const response = await axios.post(url, taskPayload, { headers });

    if (response.status === 200 || response.status === 201) {
      console.log(
        `✅ Task ${numeroAmbiente
          .toString()
          .padStart(2, "0")} criada com sucesso! Status: ${response.status}`
      );
    }

    return { ...response.data, numeroAmbiente };
  } catch (error) {
    console.error(
      `❌ Erro ao criar task ${numeroAmbiente.toString().padStart(2, "0")} "${
        taskData.title
      }":`,
      error.message
    );
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

    // Variável para numeração sequencial por ambiente
    let numeroAmbiente = 1;

    // Para cada ambiente, criar 4 tasks
    for (const ambiente of ambientes) {
      console.log(
        `🔨 Criando 4 tasks para o ambiente ${numeroAmbiente
          .toString()
          .padStart(2, "0")}: "${ambiente}"`
      );

      try {
        // Obter próximo projetista do rodízio para este ambiente
        const projetistaDoAmbiente = await obterProximoProjetista();
        console.log(
          `👤 Projetista responsável pelo ambiente ${numeroAmbiente
            .toString()
            .padStart(2, "0")}: ${projetistaDoAmbiente.name} (${
            projetistaDoAmbiente.projetistaid
          })`
        );

        // Verificar se é Vitor Libório - ele não faz checagem de medida
        const VITOR_LIBORIO_ID = "9ed8829b-7361-4695-a105-e8d3f6e7369a";
        let projetistaChecagem = projetistaDoAmbiente;

        if (projetistaDoAmbiente.projetistaid === VITOR_LIBORIO_ID) {
          console.log(
            "⚠️ Vitor Libório não faz checagem de medida, buscando próximo..."
          );
          projetistaChecagem = await obterProximoProjetista();
          console.log(
            `👤 Projetista para checagem de medida: ${projetistaChecagem.name} (${projetistaChecagem.projetistaid})`
          );
        }

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
        const task1 = await criarTask(
          token,
          ordem.id,
          {
            title: `${ambiente} Checagem de medida`,
            deadline: dataChecagem.toISOString(),
          },
          numeroAmbiente,
          projetistaChecagem // Usa o projetista específico para checagem (pode ser diferente do Vitor)
        );

        // Task 2: Revisão do Projeto (2 dias úteis após checagem)
        const dataRevisao = adicionarDiasUteis(dataChecagem, diasRevisao);
        const task2 = await criarTask(
          token,
          ordem.id,
          {
            title: `${ambiente} Revisão do Projeto`,
            deadline: dataRevisao.toISOString(),
          },
          numeroAmbiente,
          projetistaDoAmbiente
        );

        // Task 3: Envio para o Cliente (2 dias úteis após revisão)
        const dataEnvio = adicionarDiasUteis(dataRevisao, diasEnvio);
        const task3 = await criarTask(
          token,
          ordem.id,
          {
            title: `${ambiente} Envio para o Cliente`,
            deadline: dataEnvio.toISOString(),
          },
          numeroAmbiente,
          projetistaDoAmbiente
        );

        // Task 4: Aprovação do Projeto Executivo (2 dias úteis após envio)
        const dataAprovacao = adicionarDiasUteis(dataEnvio, diasAprovacao);
        const task4 = await criarTask(
          token,
          ordem.id,
          {
            title: `${ambiente} Aprovação do Projeto Executivo`,
            deadline: dataAprovacao.toISOString(),
          },
          numeroAmbiente,
          projetistaDoAmbiente
        );

        resultadosTasks.push({
          ordem: ordem.code,
          ordemId: ordem.id,
          ambiente: ambiente,
          numeroAmbiente: numeroAmbiente,
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
          `✅ 4 tasks criadas para ambiente ${numeroAmbiente
            .toString()
            .padStart(2, "0")} "${ambiente}" na ordem ${ordem.code}:`
        );
        console.log(`   � Responsável: ${projetistaDoAmbiente.name}`);
        console.log(
          `   �📅 Checagem: ${dataChecagem.toLocaleDateString("pt-BR")}`
        );
        console.log(
          `   📅 Revisão: ${dataRevisao.toLocaleDateString("pt-BR")}`
        );
        console.log(`   📅 Envio: ${dataEnvio.toLocaleDateString("pt-BR")}`);
        console.log(
          `   📅 Aprovação: ${dataAprovacao.toLocaleDateString("pt-BR")}`
        );

        // Passar rodízio para próximo ambiente apenas após criar todas as 4 tasks
        await passarRodizioParaProximo(projetistaDoAmbiente.projetistaid);

        // Incrementar número do ambiente
        numeroAmbiente++;

        // Pequeno delay entre ambientes
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(
          `⚠️ Erro ao criar tasks para ambiente ${numeroAmbiente
            .toString()
            .padStart(2, "0")} "${ambiente}" na ordem ${ordem.code}:`,
          error.message
        );
        // Incrementar mesmo em caso de erro para manter sequência
        numeroAmbiente++;
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

module.exports = {
  criarTask,
  processarAmbientesECriarTasks,
};
