const { Pool } = require("pg");
const { calcularDataChecagemMedida } = require("./date-utils");
require("dotenv").config();

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

  // Log da string de conexão (sem mostrar senha)
  const connectionString = process.env.DATABASE_PUBLIC_URL;
  if (connectionString) {
    const safeConnectionString = connectionString.replace(
      /:([^:@]+)@/,
      ":****@"
    );
    console.log(`🔗 Conectando em: ${safeConnectionString}`);
  }

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

// Função para obter o próximo projetista da vez (rodízio)
async function obterProximoProjetista() {
  console.log("🔄 Buscando próximo projetista da vez...");

  try {
    const client = await pool.connect();
    const query =
      "SELECT projetistaid, name FROM tb_pontta_rotation WHERE turn = true LIMIT 1";
    const result = await client.query(query);

    if (result.rows.length === 0) {
      throw new Error("Nenhum projetista encontrado com turn = true");
    }

    const projetistaAtual = result.rows[0];
    console.log(
      `✅ Projetista da vez: ${projetistaAtual.name} (ID: ${projetistaAtual.projetistaid})`
    );

    client.release();
    return projetistaAtual;
  } catch (error) {
    console.error("❌ Erro ao buscar próximo projetista:", error.message);
    throw error;
  }
}

// Função para passar o rodízio para o próximo projetista
async function passarRodizioParaProximo(projetistaAtualId) {
  console.log(`🔄 Passando rodízio do projetista ${projetistaAtualId}...`);

  try {
    const client = await pool.connect();

    await client.query("BEGIN");

    // 1. Marcar o atual como false
    await client.query(
      "UPDATE tb_pontta_rotation SET turn = false WHERE projetistaid = $1",
      [projetistaAtualId]
    );

    // 2. Buscar o próximo (ordenado por ID para manter sequência)
    const proximoResult = await client.query(
      `
      SELECT projetistaid, name 
      FROM tb_pontta_rotation 
      WHERE projetistaid > $1 
      ORDER BY projetistaid ASC 
      LIMIT 1
    `,
      [projetistaAtualId]
    );

    let proximoProjetista;

    if (proximoResult.rows.length > 0) {
      // Próximo na sequência
      proximoProjetista = proximoResult.rows[0];
    } else {
      // Volta para o primeiro (ciclo completo)
      const primeiroResult = await client.query(`
        SELECT projetistaid, name 
        FROM tb_pontta_rotation 
        ORDER BY projetistaid ASC 
        LIMIT 1
      `);
      proximoProjetista = primeiroResult.rows[0];
    }

    // 3. Marcar o próximo como true
    await client.query(
      "UPDATE tb_pontta_rotation SET turn = true WHERE projetistaid = $1",
      [proximoProjetista.projetistaid]
    );

    await client.query("COMMIT");
    client.release();

    console.log(
      `✅ Rodízio atualizado! Próximo: ${proximoProjetista.name} (ID: ${proximoProjetista.projetistaid})`
    );

    return proximoProjetista;
  } catch (error) {
    console.error("❌ Erro ao atualizar rodízio:", error.message);
    throw error;
  }
}

// Função para obter o próximo projetista sem alterar o rodízio (para casos especiais como Vitor Libório)
async function obterProximoProjetistaSemAlterar(projetistaAtualId) {
  console.log(
    `🔍 Buscando próximo projetista após ${projetistaAtualId} (sem alterar rodízio)...`
  );

  try {
    const client = await pool.connect();

    // Buscar o próximo na sequência
    const proximoResult = await client.query(
      `
      SELECT projetistaid, name 
      FROM tb_pontta_rotation 
      WHERE projetistaid > $1 
      ORDER BY projetistaid ASC 
      LIMIT 1
    `,
      [projetistaAtualId]
    );

    let proximoProjetista;

    if (proximoResult.rows.length > 0) {
      // Próximo na sequência
      proximoProjetista = proximoResult.rows[0];
    } else {
      // Volta para o primeiro (ciclo completo)
      const primeiroResult = await client.query(
        `
        SELECT projetistaid, name 
        FROM tb_pontta_rotation 
        WHERE projetistaid != $1
        ORDER BY projetistaid ASC 
        LIMIT 1
      `,
        [projetistaAtualId]
      );
      proximoProjetista = primeiroResult.rows[0];
    }

    client.release();

    console.log(
      `✅ Próximo projetista encontrado: ${proximoProjetista.name} (ID: ${proximoProjetista.projetistaid})`
    );

    return proximoProjetista;
  } catch (error) {
    console.error("❌ Erro ao buscar próximo projetista:", error.message);
    throw error;
  }
}

// Função para criar tabela de rodízio se não existir (apenas para desenvolvimento)
async function criarTabelaRodizioSeNaoExistir() {
  console.log("📋 Verificando se tabela tb_pontta_rotation existe...");

  try {
    const client = await pool.connect();

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS tb_pontta_rotation (
        id SERIAL PRIMARY KEY,
        projetistaid VARCHAR(255) NOT NULL UNIQUE,
        turn BOOLEAN NOT NULL DEFAULT false,
        name VARCHAR(255) NOT NULL,
        turn_v BOOLEAN DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(createTableQuery);
    console.log("✅ Tabela tb_pontta_rotation verificada/criada com sucesso!");

    // Verificar se a coluna turn_v existe, se não existir, adicionar
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='tb_pontta_rotation' AND column_name='turn_v';
    `;

    const columnResult = await client.query(checkColumnQuery);

    if (columnResult.rows.length === 0) {
      console.log(
        "📋 Adicionando coluna turn_v na tabela tb_pontta_rotation..."
      );
      await client.query(
        "ALTER TABLE tb_pontta_rotation ADD COLUMN turn_v BOOLEAN DEFAULT NULL"
      );
      console.log("✅ Coluna turn_v adicionada com sucesso!");
    }

    client.release();
    return true;
  } catch (error) {
    console.error(
      "❌ Erro ao criar/verificar tabela de rodízio:",
      error.message
    );
    throw error;
  }
}

// Função para obter o próximo projetista do rodízio específico do Vitor (turn_v)
async function obterProximoProjetistaVitor() {
  console.log(
    "🔄 Buscando próximo projetista para checagem do Vitor (turn_v)..."
  );

  try {
    const client = await pool.connect();
    const query =
      "SELECT projetistaid, name FROM tb_pontta_rotation WHERE turn_v = true AND turn_v IS NOT NULL LIMIT 1";
    const result = await client.query(query);

    if (result.rows.length === 0) {
      throw new Error("Nenhum projetista encontrado com turn_v = true");
    }

    const projetistaAtual = result.rows[0];
    console.log(
      `✅ Projetista da vez para checagem do Vitor: ${projetistaAtual.name} (ID: ${projetistaAtual.projetistaid})`
    );

    client.release();
    return projetistaAtual;
  } catch (error) {
    console.error(
      "❌ Erro ao buscar próximo projetista do rodízio Vitor:",
      error.message
    );
    throw error;
  }
}

// Função para passar o rodízio do Vitor para o próximo projetista (turn_v)
async function passarRodizioVitorParaProximo(projetistaAtualId) {
  console.log(
    `🔄 Passando rodízio Vitor do projetista ${projetistaAtualId}...`
  );

  try {
    const client = await pool.connect();

    await client.query("BEGIN");

    // 1. Marcar o atual como false
    await client.query(
      "UPDATE tb_pontta_rotation SET turn_v = false WHERE projetistaid = $1",
      [projetistaAtualId]
    );

    // 2. Buscar o próximo (ordenado por ID, apenas onde turn_v não é NULL)
    const proximoResult = await client.query(
      `
      SELECT projetistaid, name 
      FROM tb_pontta_rotation 
      WHERE projetistaid > $1 AND turn_v IS NOT NULL
      ORDER BY projetistaid ASC 
      LIMIT 1
    `,
      [projetistaAtualId]
    );

    let proximoProjetista;

    if (proximoResult.rows.length > 0) {
      // Próximo na sequência
      proximoProjetista = proximoResult.rows[0];
    } else {
      // Volta para o primeiro (ciclo completo) - apenas onde turn_v não é NULL
      const primeiroResult = await client.query(`
        SELECT projetistaid, name 
        FROM tb_pontta_rotation 
        WHERE turn_v IS NOT NULL
        ORDER BY projetistaid ASC 
        LIMIT 1
      `);
      proximoProjetista = primeiroResult.rows[0];
    }

    // 3. Marcar o próximo como true
    await client.query(
      "UPDATE tb_pontta_rotation SET turn_v = true WHERE projetistaid = $1",
      [proximoProjetista.projetistaid]
    );

    await client.query("COMMIT");
    client.release();

    console.log(
      `✅ Rodízio Vitor atualizado! Próximo: ${proximoProjetista.name} (ID: ${proximoProjetista.projetistaid})`
    );

    return proximoProjetista;
  } catch (error) {
    console.error("❌ Erro ao atualizar rodízio Vitor:", error.message);
    throw error;
  }
}

// Função para criar tabela de agendamentos de checagem se não existir
async function criarTabelaAgendamentosSeNaoExistir() {
  console.log("📋 Verificando se tabela tb_pontta_checagem_schedule existe...");

  try {
    const client = await pool.connect();

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS tb_pontta_checagem_schedule (
        id SERIAL PRIMARY KEY,
        projetistaid VARCHAR(255) NOT NULL,
        data_agendamento DATE NOT NULL,
        proximo_horario_disponivel TIME NOT NULL DEFAULT '09:00:00',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(projetistaid, data_agendamento)
      );
    `;

    await client.query(createTableQuery);
    console.log(
      "✅ Tabela tb_pontta_checagem_schedule verificada/criada com sucesso!"
    );

    client.release();
    return true;
  } catch (error) {
    console.error(
      "❌ Erro ao criar/verificar tabela de agendamentos:",
      error.message
    );
    throw error;
  }
}

// Função para obter/criar próximo horário disponível para checagem de medida
async function obterProximoHorarioChecagem(projetistaId, dataChecagem) {
  console.log(
    `⏰ Buscando próximo horário disponível para ${projetistaId} em ${dataChecagem}...`
  );

  try {
    const client = await pool.connect();

    // Converter data para formato de data sem horário
    let dataAgendamento = new Date(dataChecagem);

    // VERIFICAR SE É DIA VÁLIDO PARA CHECAGEM (qua, sex, sab)
    const diaSemana = dataAgendamento.getDay();
    let foiReagendado = false;
    if (diaSemana !== 3 && diaSemana !== 5 && diaSemana !== 6) {
      console.log(
        `⚠️ Dia ${dataAgendamento.toLocaleDateString(
          "pt-BR"
        )} não é válido para checagem, reagendando...`
      );

      // Usar a função existente para calcular próximo dia válido
      const proximoDiaValido =
        calcularProximoDiaValidoChecagem(dataAgendamento);
      console.log(`📅 Próximo dia válido para checagem: ${proximoDiaValido}`);
      dataAgendamento = new Date(proximoDiaValido);
      foiReagendado = true;

      console.log(
        `📅 Reagendado para: ${dataAgendamento.toLocaleDateString("pt-BR")}`
      );
    }

    const dataFormatada = dataAgendamento.toISOString().split("T")[0];

    // Buscar horário atual do projetista para o dia
    let scheduleResult = await client.query(
      "SELECT proximo_horario_disponivel FROM tb_pontta_checagem_schedule WHERE projetistaid = $1 AND data_agendamento = $2",
      [projetistaId, dataFormatada]
    );

    let proximoHorario;

    if (scheduleResult.rows.length === 0 || foiReagendado) {
      // GAMBIARRA: Primeiro agendamento do dia - começar às 07:30 para chegar em 09:00
      proximoHorario = "07:30:00";

      console.log(
        `✅ Primeiro agendamento do dia criado: ${proximoHorario} (GAMBIARRA: será ajustado para 09:00)`
      );
    } else {
      proximoHorario = scheduleResult.rows[0].proximo_horario_disponivel;
      console.log(`📅 Horário atual encontrado: ${proximoHorario}`);
    }

    // Verificar se o horário + 1h30min ultrapassa 17:00
    const [hora, minuto] = proximoHorario.split(":").map(Number);
    const horarioFim = new Date();
    horarioFim.setHours(hora, minuto, 0, 0);
    horarioFim.setMinutes(horarioFim.getMinutes() + 90); // Adicionar 1h30min

    const limiteHorario = new Date();
    limiteHorario.setHours(17, 0, 0, 0); // 17:00

    if (horarioFim > limiteHorario) {
      console.log(
        `⚠️ Horário ${proximoHorario} + 1h30min ultrapassa 17:00, reagendando para próximo dia...`
      );

      // Calcular próximo dia útil válido para checagem (qua, sex, sab)
      const proximoDiaChecagem =
        calcularProximoDiaValidoChecagem(dataAgendamento);

      client.release();
      return await obterProximoHorarioChecagem(
        projetistaId,
        proximoDiaChecagem
      );
    }

    // Criar o horário de início e fim para Manaus
    const dataInicioManaus = new Date(dataAgendamento);
    dataInicioManaus.setHours(hora, minuto, 0, 0);

    const dataFimManaus = new Date(dataInicioManaus);
    dataFimManaus.setMinutes(dataFimManaus.getMinutes() + 90);

    // Converter para UTC (Manaus é UTC-4)
    const dataInicioUTC = new Date(
      dataInicioManaus.getTime() + 4 * 60 * 60 * 1000
    );
    const dataFimUTC = new Date(dataFimManaus.getTime() + 4 * 60 * 60 * 1000);
    const dataAlertUTC = new Date(dataFimUTC.getTime() - 60 * 60 * 1000); // 1 hora antes do fim

    // Atualizar próximo horário disponível (fim + 0 minutos = próximo slot)
    const proximoSlot = `${String(dataFimManaus.getHours()).padStart(
      2,
      "0"
    )}:${String(dataFimManaus.getMinutes()).padStart(2, "0")}:00`;

    if (scheduleResult.rows.length === 0) {
      // Inserir registro inicial para primeiro agendamento do dia
      await client.query(
        "INSERT INTO tb_pontta_checagem_schedule (projetistaid, data_agendamento, proximo_horario_disponivel) VALUES ($1, $2, $3)",
        [projetistaId, dataFormatada, proximoSlot]
      );
    } else {
      // Atualizar próximo horário disponível
      await client.query(
        "UPDATE tb_pontta_checagem_schedule SET proximo_horario_disponivel = $1, updated_at = CURRENT_TIMESTAMP WHERE projetistaid = $2 AND data_agendamento = $3",
        [proximoSlot, projetistaId, dataFormatada]
      );
    }

    console.log(
      `✅ Agendamento confirmado: ${hora.toString().padStart(2, "0")}:${minuto
        .toString()
        .padStart(2, "0")} - ${dataFimManaus
        .getHours()
        .toString()
        .padStart(2, "0")}:${dataFimManaus
        .getMinutes()
        .toString()
        .padStart(2, "0")} (Manaus)`
    );
    console.log(`📅 Próximo slot disponível: ${proximoSlot}`);

    client.release();

    return {
      deadline: dataFimUTC.toISOString(),
      alert: dataAlertUTC.toISOString(),
      time: "90", // 1h30min em minutos
      horarioManausInicio: `${hora.toString().padStart(2, "0")}:${minuto
        .toString()
        .padStart(2, "0")}`,
      horarioManausFim: `${dataFimManaus
        .getHours()
        .toString()
        .padStart(2, "0")}:${dataFimManaus
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
      dataAgendada: dataFormatada,
    };
  } catch (error) {
    console.error(
      "❌ Erro ao obter próximo horário de checagem:",
      error.message
    );
    throw error;
  }
}

// Função auxiliar para calcular próximo dia válido para checagem (qua, sex, sab)
function calcularProximoDiaValidoChecagem(dataAtual) {
  const proximoDia = new Date(dataAtual);
  proximoDia.setDate(proximoDia.getDate() + 1);

  while (true) {
    const diaSemana = proximoDia.getDay();
    if (diaSemana === 3 || diaSemana === 5 || diaSemana === 6) {
      // Quarta, sexta ou sábado
      break;
    }
    proximoDia.setDate(proximoDia.getDate() + 1);
  }

  console.log(
    `📅 Próximo dia válido para checagem: ${
      proximoDia.toISOString().split("T")[0]
    }`
  );
  return proximoDia;
}

// Função para configurar rodízio inicial do Vitor (turn_v) - apenas para setup inicial
async function configurarRodizioVitorInicial() {
  console.log("🔧 Configurando rodízio inicial do Vitor (turn_v)...");

  try {
    const client = await pool.connect();

    // Verificar se já existe algum com turn_v = true
    const verificarResult = await client.query(
      "SELECT COUNT(*) as count FROM tb_pontta_rotation WHERE turn_v = true"
    );

    if (parseInt(verificarResult.rows[0].count) === 0) {
      // Se nenhum tem turn_v = true, configurar Anna Alice como primeira
      const annaAliceId = "c70c4e46-459a-4c60-b500-77b59b156d49";

      await client.query(
        "UPDATE tb_pontta_rotation SET turn_v = true WHERE projetistaid = $1",
        [annaAliceId]
      );

      console.log(
        "✅ Anna Alice configurada como primeira no rodízio do Vitor"
      );
    } else {
      console.log("ℹ️ Rodízio do Vitor já está configurado");
    }

    client.release();
    return true;
  } catch (error) {
    console.error(
      "❌ Erro ao configurar rodízio inicial do Vitor:",
      error.message
    );
    throw error;
  }
}

// Função para limpar agendamentos de dias anteriores automaticamente
async function limparAgendamentosAntigos() {
  console.log("🧹 Limpando agendamentos de dias anteriores...");

  try {
    const client = await pool.connect();
    const hoje = new Date().toISOString().split("T")[0];

    const query =
      "DELETE FROM tb_pontta_checagem_schedule WHERE data_agendamento < $1";
    const result = await client.query(query, [hoje]);

    client.release();

    if (result.rowCount > 0) {
      console.log(`✅ ${result.rowCount} agendamentos antigos removidos`);
    } else {
      console.log("ℹ️ Nenhum agendamento antigo encontrado");
    }

    return result.rowCount;
  } catch (error) {
    console.error("❌ Erro ao limpar agendamentos antigos:", error.message);
    throw error;
  }
}

// Função para limpar agendamentos de um dia específico (para testes)
async function limparAgendamentosDia(dataAgendamento) {
  console.log(`🗑️ Limpando agendamentos do dia ${dataAgendamento}...`);

  try {
    const client = await pool.connect();
    const dataFormatada = new Date(dataAgendamento).toISOString().split("T")[0];

    const query =
      "DELETE FROM tb_pontta_checagem_schedule WHERE data_agendamento = $1";
    const result = await client.query(query, [dataFormatada]);

    client.release();

    console.log(
      `✅ Agendamentos do dia ${dataFormatada} removidos. Linhas afetadas: ${result.rowCount}`
    );

    return result.rowCount;
  } catch (error) {
    console.error(
      `❌ Erro ao limpar agendamentos do dia ${dataAgendamento}:`,
      error.message
    );
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

// Função para criar tabela de controle de checagens por pedido se não existir
async function criarTabelaChecagemPedidoSeNaoExistir() {
  console.log("📋 Verificando se tabela tb_pontta_checagem_pedido existe...");

  try {
    const client = await pool.connect();

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS tb_pontta_checagem_pedido (
        id SERIAL PRIMARY KEY,
        projetistaid VARCHAR(255) NOT NULL,
        sales_order_id VARCHAR(255) NOT NULL,
        data_checagem DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_checagem_projetista_data 
      ON tb_pontta_checagem_pedido (projetistaid, data_checagem);
      
      CREATE INDEX IF NOT EXISTS idx_checagem_pedido 
      ON tb_pontta_checagem_pedido (sales_order_id);
    `;

    await client.query(createTableQuery);
    console.log(
      "✅ Tabela tb_pontta_checagem_pedido verificada/criada com sucesso!"
    );

    client.release();
    return true;
  } catch (error) {
    console.error(
      "❌ Erro ao criar/verificar tabela de checagem por pedido:",
      error.message
    );
    throw error;
  }
}

// Função para verificar se o atendente já tem checagem de outro pedido no dia
async function verificarConflitoChecagemPorPedido(
  projetistaId,
  dataChecagem,
  salesOrderId
) {
  console.log(
    `🔍 Verificando conflito de checagem para ${projetistaId} em ${dataChecagem} (pedido ${salesOrderId})...`
  );

  try {
    const client = await pool.connect();

    const dataFormatada = new Date(dataChecagem).toISOString().split("T")[0];

    // Buscar se existe checagem de OUTRO pedido nesse dia para esse projetista
    const result = await client.query(
      `SELECT sales_order_id FROM tb_pontta_checagem_pedido 
       WHERE projetistaid = $1 
       AND data_checagem = $2 
       AND sales_order_id != $3
       LIMIT 1`,
      [projetistaId, dataFormatada, salesOrderId]
    );

    client.release();

    if (result.rows.length > 0) {
      console.log(
        `⚠️ CONFLITO: Projetista ${projetistaId} já tem checagem do pedido ${result.rows[0].sales_order_id} em ${dataFormatada}`
      );
      return true; // Tem conflito
    }

    console.log(`✅ Sem conflito de checagem para ${dataFormatada}`);
    return false; // Não tem conflito
  } catch (error) {
    console.error("❌ Erro ao verificar conflito de checagem:", error.message);
    throw error;
  }
}

// Função para registrar checagem agendada por pedido
async function registrarChecagemPedido(
  projetistaId,
  salesOrderId,
  dataChecagem
) {
  console.log(
    `📝 Registrando checagem do pedido ${salesOrderId} para ${projetistaId} em ${dataChecagem}...`
  );

  try {
    const client = await pool.connect();

    const dataFormatada = new Date(dataChecagem).toISOString().split("T")[0];

    // Inserir registro da checagem
    await client.query(
      `INSERT INTO tb_pontta_checagem_pedido (projetistaid, sales_order_id, data_checagem) 
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [projetistaId, salesOrderId, dataFormatada]
    );

    console.log(
      `✅ Checagem registrada: pedido ${salesOrderId} -> ${projetistaId} em ${dataFormatada}`
    );

    client.release();
    return true;
  } catch (error) {
    console.error("❌ Erro ao registrar checagem do pedido:", error.message);
    throw error;
  }
}

// Função para limpar checagens antigas (mais de 90 dias)
async function limparChecagensPedidoAntigas() {
  console.log("🧹 Limpando checagens de pedidos antigas...");

  try {
    const client = await pool.connect();

    const result = await client.query(
      `DELETE FROM tb_pontta_checagem_pedido 
       WHERE data_checagem < CURRENT_DATE - INTERVAL '90 days'`
    );

    console.log(
      `✅ ${result.rowCount} registros de checagem antigos removidos`
    );

    client.release();
    return result.rowCount;
  } catch (error) {
    console.error("❌ Erro ao limpar checagens antigas:", error.message);
    throw error;
  }
}

module.exports = {
  pool,
  testarConexaoBanco,
  criarTabelaSeNaoExistir,
  verificarOrdemExiste,
  salvarOrdemNoBanco,
  limparOrdemDoBanco,
  obterProximoProjetista,
  obterProximoProjetistaSemAlterar,
  passarRodizioParaProximo,
  obterProximoProjetistaVitor,
  passarRodizioVitorParaProximo,
  criarTabelaRodizioSeNaoExistir,
  configurarRodizioVitorInicial,
  criarTabelaAgendamentosSeNaoExistir,
  obterProximoHorarioChecagem,
  limparAgendamentosAntigos,
  limparAgendamentosDia,
  criarTabelaChecagemPedidoSeNaoExistir,
  verificarConflitoChecagemPorPedido,
  registrarChecagemPedido,
  limparChecagensPedidoAntigas,
};
