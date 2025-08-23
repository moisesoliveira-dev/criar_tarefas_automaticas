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

  // Para checagem de medida: adicionar 1 dia extra à distância normal
  const diasComExtraChecagem = diasMinimos + 1;
  
  console.log(
    `📅 Calculando ${diasMinimos} dias úteis + 1 dia extra para checagem = ${diasComExtraChecagem} dias úteis a partir do dia seguinte à venda`
  );

  const dataMinima = adicionarDiasUteis(dataVendaObj, diasComExtraChecagem);

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
  adicionarDiasUteis,
  calcularDataChecagemMedida,
  obterDatasConsulta,
};
