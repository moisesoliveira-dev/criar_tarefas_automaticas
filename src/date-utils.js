// Função para verificar se é dia útil (seg-sex)
function isDiaUtil(data) {
  const diaSemana = data.getDay();
  return diaSemana >= 1 && diaSemana <= 5; // 1=segunda, 5=sexta
}

// Função para verificar se é dia válido para checagem de medida (qua, sex, sab)
function isDiaValidoChecagem(data) {
  const diaSemana = data.getDay();
  return diaSemana === 3 || diaSemana === 5 || diaSemana === 6; // 3=quarta, 5=sexta, 6=sábado
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

  // Criar nova data para evitar problemas de fuso horário
  // Definir explicitamente para 23:59 no dia correto
  const ano = resultado.getFullYear();
  const mes = resultado.getMonth();
  const dia = resultado.getDate();

  // Criar nova data local com horário 23:59
  const dataFinal = new Date(ano, mes, dia, 23, 59, 59, 999);

  return dataFinal;
}

// Função para calcular data de checagem de medida (apenas qua, sex, sab - 2 dias após venda mínimo)
function calcularDataChecagemMedida(dataVenda, diasMinimos) {
  const dataVendaObj = new Date(dataVenda);

  // Para checagem de medida: adicionar 1 dia extra à distância normal
  const diasComExtraChecagem = diasMinimos + 1;

  console.log(
    `📅 Calculando ${diasMinimos} dias úteis + 1 dia extra para checagem = ${diasComExtraChecagem} dias úteis a partir do dia seguinte à venda`
  );

  const dataMinima = adicionarDiasUteis(dataVendaObj, diasComExtraChecagem);

  // Verificar se a data mínima cai em qua, sex ou sab
  const diaSemana = dataMinima.getDay();

  if (diaSemana === 3 || diaSemana === 5 || diaSemana === 6) {
    // Já é qua, sex ou sab - manter a data
    const ano = dataMinima.getFullYear();
    const mes = dataMinima.getMonth();
    const dia = dataMinima.getDate();
    return new Date(ano, mes, dia, 23, 59, 59, 999);
  } else if (diaSemana === 1) {
    // Segunda -> próxima quarta
    dataMinima.setDate(dataMinima.getDate() + 2);
    const ano = dataMinima.getFullYear();
    const mes = dataMinima.getMonth();
    const dia = dataMinima.getDate();
    return new Date(ano, mes, dia, 23, 59, 59, 999);
  } else if (diaSemana === 2) {
    // Terça -> próxima quarta
    dataMinima.setDate(dataMinima.getDate() + 1);
    const ano = dataMinima.getFullYear();
    const mes = dataMinima.getMonth();
    const dia = dataMinima.getDate();
    return new Date(ano, mes, dia, 23, 59, 59, 999);
  } else if (diaSemana === 4) {
    // Quinta -> próxima sexta
    dataMinima.setDate(dataMinima.getDate() + 1);
    const ano = dataMinima.getFullYear();
    const mes = dataMinima.getMonth();
    const dia = dataMinima.getDate();
    return new Date(ano, mes, dia, 23, 59, 59, 999);
  } else {
    // Domingo -> próximo sábado (6 dias)
    dataMinima.setDate(dataMinima.getDate() + 6);
    const ano = dataMinima.getFullYear();
    const mes = dataMinima.getMonth();
    const dia = dataMinima.getDate();
    return new Date(ano, mes, dia, 23, 59, 59, 999);
  }
}

// Função para obter as datas do dia atual para consulta na API
function obterDatasConsulta() {
  const hoje = new Date();

  // Obter a data atual em formato YYYY-MM-DD no timezone de Manaus
  const dataManaus = new Date(
    hoje.toLocaleString("en-US", { timeZone: "America/Manaus" })
  );

  // Criar string da data no formato correto (sempre 04:00 UTC para representar 00:00 Manaus)
  const ano = dataManaus.getFullYear();
  const mes = String(dataManaus.getMonth() + 1).padStart(2, "0");
  const dia = String(dataManaus.getDate()).padStart(2, "0");

  const dataString = `${ano}-${mes}-${dia}T04:00:00.000Z`;

  console.log(`📅 Data calculada para consulta: ${ano}-${mes}-${dia} (Manaus)`);
  console.log(`🔗 URL será: ${dataString}`);

  return {
    start: dataString,
    end: dataString,
  };
}

module.exports = {
  isDiaUtil,
  isDiaValidoChecagem,
  adicionarDiasUteis,
  calcularDataChecagemMedida,
  obterDatasConsulta,
};
