export const materialCalculatorTemplates = [
  {
    id: 'tomada',
    nome: 'Novo ponto de tomada',
    pontoLabel: 'Quantidade de tomadas',
    distanciaLabel: 'Distância média do quadro até cada tomada (m)',
    help: 'Calcula cabo fase/neutro/terra, eletroduto, caixas, tomadas, conectores e disjuntor quando for circuito novo.',
    defaultValues: {
      pontos: 1,
      distanciaMetros: 8,
      reservaPercentual: 15,
      circuitoNovo: true,
      incluirAparelho: true,
    },
  },
  {
    id: 'chuveiro',
    nome: 'Instalação de chuveiro',
    pontoLabel: 'Quantidade de chuveiros',
    distanciaLabel: 'Distância do quadro até o chuveiro (m)',
    help: 'Calcula cabo 6mm para duas fases e terra, eletroduto, disjuntor bipolar, conectores e chuveiro opcional.',
    defaultValues: {
      pontos: 1,
      distanciaMetros: 12,
      reservaPercentual: 15,
      circuitoNovo: true,
      incluirAparelho: true,
    },
  },
  {
    id: 'luminaria',
    nome: 'Pontos de iluminação',
    pontoLabel: 'Quantidade de luminárias',
    distanciaLabel: 'Distância média até cada luminária (m)',
    help: 'Calcula cabo 1,5mm, eletroduto, caixas, interruptores e luminárias quando incluídas.',
    defaultValues: {
      pontos: 2,
      distanciaMetros: 6,
      reservaPercentual: 15,
      circuitoNovo: false,
      incluirAparelho: true,
    },
  },
];

const fallbackPrices = {
  'Cabo flexível 1,5mm': { precoVenda: 4.2, custo: 2.7 },
  'Cabo flexível 2,5mm': { precoVenda: 5.9, custo: 3.8 },
  'Cabo flexível 6mm': { precoVenda: 12.9, custo: 8.8 },
  'Eletroduto corrugado 20mm': { precoVenda: 4.9, custo: 3.1 },
  'Caixa 4x2 embutir': { precoVenda: 8.9, custo: 5.4 },
  'Conector de emenda': { precoVenda: 3.5, custo: 1.8 },
  'Disjuntor monopolar 10A': { precoVenda: 24.9, custo: 16.5 },
  'Disjuntor monopolar 20A': { precoVenda: 28.9, custo: 19.5 },
  'Disjuntor bipolar 32A': { precoVenda: 58.9, custo: 41.5 },
  'Tomada 10A com placa': { precoVenda: 22.9, custo: 14.2 },
  'Interruptor simples com placa': { precoVenda: 19.9, custo: 12.5 },
  'Fita isolante antichama': { precoVenda: 11.9, custo: 7.4 },
  'Chuveiro elétrico 220V': { precoVenda: 249.9, custo: 185 },
  'Luminária LED sobrepor': { precoVenda: 69.9, custo: 45 },
};

const fallbackServices = {
  'Instalação de ponto de tomada': { valorHora: 95 },
  'Instalação de chuveiro elétrico': { valorHora: 140 },
  'Instalação de luminária': { valorHora: 90 },
};

const asPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const roundUp = (value) => Math.ceil(value);

const findCatalogMaterial = (catalogo, nome) => {
  return catalogo.find(item => item.nome === nome) || {};
};

const findCatalogService = (catalogo, descricao) => {
  return catalogo.find(item => item.descricao === descricao) || {};
};

const buildMaterial = (catalogo, nome, qtd, observacao = '') => {
  const catalogItem = findCatalogMaterial(catalogo, nome);
  const fallback = fallbackPrices[nome] || { precoVenda: 0, custo: 0 };

  return {
    nome,
    qtd: roundUp(qtd),
    precoVenda: Number(catalogItem.precoVenda ?? fallback.precoVenda),
    custo: Number(catalogItem.custo ?? fallback.custo),
    observacao,
  };
};

const buildService = (catalogo, descricao, horas) => {
  const catalogItem = findCatalogService(catalogo, descricao);
  const fallback = fallbackServices[descricao] || { valorHora: 90 };

  return {
    descricao,
    horas: Math.max(1, roundUp(horas)),
    valorHora: Number(catalogItem.valorHora ?? fallback.valorHora),
  };
};

const cableMeters = ({ distanciaMetros, pontos, condutores, reservaPercentual }) => {
  return roundUp(distanciaMetros * pontos * condutores * (1 + reservaPercentual / 100));
};

const conduitMeters = ({ distanciaMetros, pontos }) => {
  return roundUp(distanciaMetros * pontos * 1.1);
};

export function getMaterialCalculatorTemplate(templateId) {
  return materialCalculatorTemplates.find(template => template.id === templateId) || materialCalculatorTemplates[0];
}

export function calculateMaterialPlan(templateId, rawValues = {}, catalogo = {}) {
  const template = getMaterialCalculatorTemplate(templateId);
  const values = {
    ...template.defaultValues,
    ...rawValues,
  };

  const pontos = asPositiveNumber(values.pontos, template.defaultValues.pontos);
  const distanciaMetros = asPositiveNumber(values.distanciaMetros, template.defaultValues.distanciaMetros);
  const reservaPercentual = Math.max(0, Number(values.reservaPercentual ?? template.defaultValues.reservaPercentual));
  const circuitoNovo = Boolean(values.circuitoNovo);
  const incluirAparelho = Boolean(values.incluirAparelho);
  const materiaisCatalogo = catalogo.materiais || [];
  const servicosCatalogo = catalogo.servicos || [];

  const common = {
    pontos,
    distanciaMetros,
    reservaPercentual,
  };

  if (template.id === 'chuveiro') {
    const cabo = cableMeters({ ...common, condutores: 3 });
    const materiais = [
      buildMaterial(materiaisCatalogo, 'Cabo flexível 6mm', cabo, '2 fases + terra com reserva técnica'),
      buildMaterial(materiaisCatalogo, 'Eletroduto corrugado 20mm', conduitMeters(common), 'Trajeto com 10% de sobra'),
      buildMaterial(materiaisCatalogo, 'Conector de emenda', pontos * 3, 'Conexões fase/fase/terra'),
      buildMaterial(materiaisCatalogo, 'Fita isolante antichama', 1, 'Acabamento e isolamento'),
    ];

    if (circuitoNovo) {
      materiais.push(buildMaterial(materiaisCatalogo, 'Disjuntor bipolar 32A', pontos, 'Circuito novo dedicado'));
    }

    if (incluirAparelho) {
      materiais.push(buildMaterial(materiaisCatalogo, 'Chuveiro elétrico 220V', pontos, 'Aparelho principal'));
    }

    return {
      template,
      materiais,
      servicos: [buildService(servicosCatalogo, 'Instalação de chuveiro elétrico', pontos * 1.5)],
      resumo: [
        `Cabo = ${distanciaMetros}m x ${pontos} ponto(s) x 3 condutores + ${reservaPercentual}% = ${cabo}m.`,
        `Eletroduto = ${distanciaMetros}m x ${pontos} ponto(s) + 10% = ${conduitMeters(common)}m.`,
      ],
    };
  }

  if (template.id === 'luminaria') {
    const cabo = cableMeters({ ...common, condutores: 3 });
    const materiais = [
      buildMaterial(materiaisCatalogo, 'Cabo flexível 1,5mm', cabo, 'Fase, retorno/neutro e terra com reserva'),
      buildMaterial(materiaisCatalogo, 'Eletroduto corrugado 20mm', conduitMeters(common), 'Trajeto com 10% de sobra'),
      buildMaterial(materiaisCatalogo, 'Caixa 4x2 embutir', pontos, 'Ponto de comando/acabamento'),
      buildMaterial(materiaisCatalogo, 'Interruptor simples com placa', pontos, 'Comando do ponto de luz'),
      buildMaterial(materiaisCatalogo, 'Conector de emenda', pontos * 3, 'Conexões do ponto'),
      buildMaterial(materiaisCatalogo, 'Fita isolante antichama', 1, 'Acabamento e isolamento'),
    ];

    if (incluirAparelho) {
      materiais.push(buildMaterial(materiaisCatalogo, 'Luminária LED sobrepor', pontos, 'Aparelho principal'));
    }

    return {
      template,
      materiais,
      servicos: [buildService(servicosCatalogo, 'Instalação de luminária', pontos)],
      resumo: [
        `Cabo = ${distanciaMetros}m x ${pontos} ponto(s) x 3 condutores + ${reservaPercentual}% = ${cabo}m.`,
        `Caixas e interruptores = ${pontos} unidade(s).`,
      ],
    };
  }

  const cabo = cableMeters({ ...common, condutores: 3 });
  const materiais = [
    buildMaterial(materiaisCatalogo, 'Cabo flexível 2,5mm', cabo, 'Fase, neutro e terra com reserva técnica'),
    buildMaterial(materiaisCatalogo, 'Eletroduto corrugado 20mm', conduitMeters(common), 'Trajeto com 10% de sobra'),
    buildMaterial(materiaisCatalogo, 'Caixa 4x2 embutir', pontos, 'Uma caixa por tomada'),
    buildMaterial(materiaisCatalogo, 'Tomada 10A com placa', pontos, 'Acabamento do ponto'),
    buildMaterial(materiaisCatalogo, 'Conector de emenda', pontos * 3, 'Conexões fase/neutro/terra'),
    buildMaterial(materiaisCatalogo, 'Fita isolante antichama', 1, 'Acabamento e isolamento'),
  ];

  if (circuitoNovo) {
    materiais.push(buildMaterial(materiaisCatalogo, 'Disjuntor monopolar 20A', 1, 'Circuito novo'));
  }

  return {
    template,
    materiais,
    servicos: [buildService(servicosCatalogo, 'Instalação de ponto de tomada', pontos * 2)],
    resumo: [
      `Cabo = ${distanciaMetros}m x ${pontos} ponto(s) x 3 condutores + ${reservaPercentual}% = ${cabo}m.`,
      `Tomadas e caixas = ${pontos} unidade(s).`,
      circuitoNovo ? 'Incluído disjuntor porque a opção circuito novo está ativa.' : 'Sem disjuntor porque a opção circuito novo está desligada.',
    ],
  };
}
