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

// Função para obter as datas do dia atual para consulta na API
function obterDatasConsulta() {
  const hoje = new Date();

  // Criar data no início do dia (04:00 UTC = 00:00 Manaus)
  const start = new Date(hoje);
  start.setUTCHours(4, 0, 0, 0);

  // End é o mesmo que start para consultar apenas o dia atual
  const end = new Date(start);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

module.exports = {
  isDiaUtil,
  adicionarDiasUteis,
  calcularDataChecagemMedida,
  obterDatasConsulta,
};
