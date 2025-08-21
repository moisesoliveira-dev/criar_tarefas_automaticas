const { Pool } = require("pg");
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(createTableQuery);
    console.log("✅ Tabela tb_pontta_rotation verificada/criada com sucesso!");

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

module.exports = {
  pool,
  testarConexaoBanco,
  criarTabelaSeNaoExistir,
  verificarOrdemExiste,
  salvarOrdemNoBanco,
  limparOrdemDoBanco,
  obterProximoProjetista,
  passarRodizioParaProximo,
  criarTabelaRodizioSeNaoExistir,
};
