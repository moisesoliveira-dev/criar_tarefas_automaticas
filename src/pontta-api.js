const axios = require("axios");
const { verificarOrdemExiste } = require("./database");
const { obterDatasConsulta } = require("./date-utils");
require("dotenv").config();

let currentToken = null;

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
    // Obter datas dinâmicas do dia atual
    const { start, end } = obterDatasConsulta();

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

module.exports = {
  autenticarPontta,
  recuperarOrdensPedido,
  buscarDetalhesOrdem,
  processarDetalhesOrdens,
};
