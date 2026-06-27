// Função para verificar se é feriado em Manaus (municipal ou nacional)
function isFeriadoManaus(data) {
  const dia = data.getDate();
  const mes = data.getMonth() + 1; // 0-11 -> 1-12
  const ano = data.getFullYear();

  // Feriados nacionais fixos
  const feriadosFixos = [
    { dia: 1, mes: 1 }, // Ano Novo
    { dia: 21, mes: 4 }, // Tiradentes
    { dia: 1, mes: 5 }, // Dia do Trabalho
    { dia: 7, mes: 9 }, // Independência do Brasil
    { dia: 12, mes: 10 }, // Nossa Senhora Aparecida
    { dia: 2, mes: 11 }, // Finados
    { dia: 15, mes: 11 }, // Proclamação da República
    { dia: 20, mes: 11 }, // Dia da Consciência Negra
    { dia: 24, mes: 12 }, // Véspera de Natal
    { dia: 25, mes: 12 }, // Natal
    { dia: 31, mes: 12 }, // Véspera de Ano Novo
    // Feriados estaduais do Amazonas
    { dia: 5, mes: 9 }, // Elevação do Amazonas à categoria de província
    // Feriados municipais de Manaus
    { dia: 8, mes: 12 }, // Nossa Senhora da Conceição (padroeira de Manaus)
    { dia: 24, mes: 10 }, // Aniversário de Manaus
  ];

  // Verificar feriados fixos
  for (const feriado of feriadosFixos) {
    if (dia === feriado.dia && mes === feriado.mes) {
      return true;
    }
  }

  // Feriados móveis (calculados para cada ano)
  const feriadosMoveis = calcularFeriadosMoveis(ano);

  const dataStr = `${ano}-${String(mes).padStart(2, "0")}-${String(
    dia
  ).padStart(2, "0")}`;

  return feriadosMoveis.includes(dataStr);
}

// Função para calcular feriados móveis baseados na Páscoa
function calcularFeriadosMoveis(ano) {
  const pascoa = calcularPascoa(ano);
  const feriadosMoveis = [];

  // Adicionar a própria Páscoa (domingo, mas registramos)
  feriadosMoveis.push(formatarData(pascoa));

  // Carnaval (47 dias antes da Páscoa - terça-feira)
  const carnaval = new Date(pascoa);
  carnaval.setDate(carnaval.getDate() - 47);
  feriadosMoveis.push(formatarData(carnaval));

  // Segunda de Carnaval (48 dias antes da Páscoa)
  const segundaCarnaval = new Date(pascoa);
  segundaCarnaval.setDate(segundaCarnaval.getDate() - 48);
  feriadosMoveis.push(formatarData(segundaCarnaval));

  // Sexta-feira Santa (2 dias antes da Páscoa)
  const sextaSanta = new Date(pascoa);
  sextaSanta.setDate(sextaSanta.getDate() - 2);
  feriadosMoveis.push(formatarData(sextaSanta));

  // Corpus Christi (60 dias depois da Páscoa)
  const corpusChristi = new Date(pascoa);
  corpusChristi.setDate(corpusChristi.getDate() + 60);
  feriadosMoveis.push(formatarData(corpusChristi));

  return feriadosMoveis;
}

// Função para calcular a data da Páscoa (Algoritmo de Meeus)
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(ano, mes - 1, dia);
}

// Função auxiliar para formatar data como string YYYY-MM-DD
function formatarData(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Função para verificar se está no período de recesso da loja (20/12 a 21/01)
function isPeriodoRecesso(data) {
  const dia = data.getDate();
  const mes = data.getMonth() + 1; // 0-11 -> 1-12

  // De 20/12 até 31/12
  if (mes === 12 && dia >= 20) {
    return true;
  }

  // De 01/01 até 21/01
  if (mes === 1 && dia <= 21) {
    return true;
  }

  return false;
}

// Função para verificar se é dia útil (seg-sex, não feriado e não recesso)
function isDiaUtil(data) {
  const diaSemana = data.getDay();
  const fimDeSemana = diaSemana === 0 || diaSemana === 6; // 0=domingo, 6=sábado

  if (fimDeSemana) {
    return false;
  }

  // Verificar se é feriado
  if (isFeriadoManaus(data)) {
    return false;
  }

  // Verificar se está no período de recesso
  if (isPeriodoRecesso(data)) {
    return false;
  }

  return true; // Segunda a sexta, não é feriado e não está em recesso
}

// Função para verificar se é dia válido para checagem de medida (qua, sex, não feriado e não recesso)
function isDiaValidoChecagem(data) {
  const diaSemana = data.getDay();
  const isDiaPermitido = diaSemana === 3 || diaSemana === 5; // 3=quarta, 5=sexta

  if (!isDiaPermitido) {
    return false;
  }

  // Verificar se é feriado
  if (isFeriadoManaus(data)) {
    return false;
  }

  // Verificar se está no período de recesso
  if (isPeriodoRecesso(data)) {
    return false;
  }

  return true;
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

// Função para calcular data de checagem de medida (apenas qua, sex - 2 dias após venda mínimo, excluindo feriados)
function calcularDataChecagemMedida(dataVenda, diasMinimos) {
  const dataVendaObj = new Date(dataVenda);

  // Para checagem de medida: adicionar 1 dia extra à distância normal
  const diasComExtraChecagem = diasMinimos + 1;

  console.log(
    `📅 Calculando ${diasMinimos} dias úteis + 1 dia extra para checagem = ${diasComExtraChecagem} dias úteis a partir do dia seguinte à venda`
  );

  const dataMinima = adicionarDiasUteis(dataVendaObj, diasComExtraChecagem);

  // Avançar para o próximo dia válido (qua ou sex) que não seja feriado
  let dataFinal = new Date(dataMinima);

  while (!isDiaValidoChecagem(dataFinal)) {
    dataFinal.setDate(dataFinal.getDate() + 1);
  }

  const ano = dataFinal.getFullYear();
  const mes = dataFinal.getMonth();
  const dia = dataFinal.getDate();

  return new Date(ano, mes, dia, 23, 59, 59, 999);
}

// Aprovação do Projeto Executivo: N dias úteis após o projeto executivo, sempre em sábado
function calcularDataAprovacaoExecutivo(dataProjetoExecutivo, diasUteis) {
  const dataComDias = adicionarDiasUteis(dataProjetoExecutivo, diasUteis);
  const dataFinal = new Date(dataComDias);

  while (dataFinal.getDay() !== 6) {
    dataFinal.setDate(dataFinal.getDate() + 1);
  }

  const ano = dataFinal.getFullYear();
  const mes = dataFinal.getMonth();
  const dia = dataFinal.getDate();

  return new Date(ano, mes, dia, 23, 59, 59, 999);
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
  calcularDataAprovacaoExecutivo,
  obterDatasConsulta,
};
