export const catalogoMateriais = [
  { id: 'mat-cabo-15', categoria: 'Elétrica', nome: 'Cabo flexível 1,5mm', unidade: 'metro', qtd: 10, precoVenda: 4.2, custo: 2.7 },
  { id: 'mat-cabo-25', categoria: 'Elétrica', nome: 'Cabo flexível 2,5mm', unidade: 'metro', qtd: 10, precoVenda: 5.9, custo: 3.8 },
  { id: 'mat-cabo-40', categoria: 'Elétrica', nome: 'Cabo flexível 4mm', unidade: 'metro', qtd: 10, precoVenda: 8.5, custo: 5.6 },
  { id: 'mat-cabo-60', categoria: 'Elétrica', nome: 'Cabo flexível 6mm', unidade: 'metro', qtd: 10, precoVenda: 12.9, custo: 8.8 },
  { id: 'mat-eletroduto-20', categoria: 'Elétrica', nome: 'Eletroduto corrugado 20mm', unidade: 'metro', qtd: 5, precoVenda: 4.9, custo: 3.1 },
  { id: 'mat-caixa-4x2', categoria: 'Elétrica', nome: 'Caixa 4x2 embutir', unidade: 'un', qtd: 1, precoVenda: 8.9, custo: 5.4 },
  { id: 'mat-conector', categoria: 'Elétrica', nome: 'Conector de emenda', unidade: 'un', qtd: 3, precoVenda: 3.5, custo: 1.8 },
  { id: 'mat-disjuntor-10a', categoria: 'Elétrica', nome: 'Disjuntor monopolar 10A', unidade: 'un', qtd: 1, precoVenda: 24.9, custo: 16.5 },
  { id: 'mat-disjuntor-20a', categoria: 'Elétrica', nome: 'Disjuntor monopolar 20A', unidade: 'un', qtd: 1, precoVenda: 28.9, custo: 19.5 },
  { id: 'mat-disjuntor-32a', categoria: 'Elétrica', nome: 'Disjuntor bipolar 32A', unidade: 'un', qtd: 1, precoVenda: 58.9, custo: 41.5 },
  { id: 'mat-tomada-10a', categoria: 'Elétrica', nome: 'Tomada 10A com placa', unidade: 'un', qtd: 1, precoVenda: 22.9, custo: 14.2 },
  { id: 'mat-interruptor', categoria: 'Elétrica', nome: 'Interruptor simples com placa', unidade: 'un', qtd: 1, precoVenda: 19.9, custo: 12.5 },
  { id: 'mat-fita-isolante', categoria: 'Elétrica', nome: 'Fita isolante antichama', unidade: 'un', qtd: 1, precoVenda: 11.9, custo: 7.4 },
  { id: 'mat-chuveiro', categoria: 'Elétrica', nome: 'Chuveiro elétrico 220V', unidade: 'un', qtd: 1, precoVenda: 249.9, custo: 185 },
  { id: 'mat-luminaria', categoria: 'Elétrica', nome: 'Luminária LED sobrepor', unidade: 'un', qtd: 1, precoVenda: 69.9, custo: 45 },
  { id: 'mat-sifao', categoria: 'Hidráulica', nome: 'Sifão flexível universal', unidade: 'un', qtd: 1, precoVenda: 24.9, custo: 14.9 },
  { id: 'mat-torneira', categoria: 'Hidráulica', nome: 'Torneira de parede', unidade: 'un', qtd: 1, precoVenda: 89.9, custo: 62 },
  { id: 'mat-tubo-pvc', categoria: 'Hidráulica', nome: 'Tubo PVC 25mm', unidade: 'metro', qtd: 3, precoVenda: 12.9, custo: 8.2 },
  { id: 'mat-registro', categoria: 'Hidráulica', nome: 'Registro esfera 1/2"', unidade: 'un', qtd: 1, precoVenda: 36.9, custo: 24.5 },
  { id: 'mat-veda-rosca', categoria: 'Hidráulica', nome: 'Fita veda rosca', unidade: 'un', qtd: 1, precoVenda: 7.9, custo: 4.2 },
  { id: 'mat-tinta', categoria: 'Pintura', nome: 'Tinta acrílica premium 3,6L', unidade: 'un', qtd: 1, precoVenda: 149.9, custo: 109 },
  { id: 'mat-massa', categoria: 'Pintura', nome: 'Massa corrida 5,5kg', unidade: 'un', qtd: 1, precoVenda: 42.9, custo: 29 },
  { id: 'mat-rolo', categoria: 'Pintura', nome: 'Rolo de pintura anti respingo', unidade: 'un', qtd: 1, precoVenda: 27.9, custo: 17.5 },
  { id: 'mat-fita-crepe', categoria: 'Pintura', nome: 'Fita crepe para acabamento', unidade: 'un', qtd: 1, precoVenda: 12.9, custo: 7.8 },
  { id: 'mat-argamassa', categoria: 'Acabamento', nome: 'Argamassa AC-II 20kg', unidade: 'un', qtd: 1, precoVenda: 39.9, custo: 27.5 },
  { id: 'mat-rejunte', categoria: 'Acabamento', nome: 'Rejunte flexível 1kg', unidade: 'un', qtd: 1, precoVenda: 18.9, custo: 11.6 },
];

export const catalogoServicos = [
  { id: 'serv-chuveiro', categoria: 'Elétrica', descricao: 'Instalação de chuveiro elétrico', horas: 1, valorHora: 140 },
  { id: 'serv-tomada', categoria: 'Elétrica', descricao: 'Instalação de ponto de tomada', horas: 2, valorHora: 95 },
  { id: 'serv-luminaria', categoria: 'Elétrica', descricao: 'Instalação de luminária', horas: 1, valorHora: 90 },
  { id: 'serv-fiação', categoria: 'Elétrica', descricao: 'Passagem de fiação por ponto', horas: 2, valorHora: 110 },
  { id: 'serv-quadro', categoria: 'Elétrica', descricao: 'Organização de quadro elétrico', horas: 3, valorHora: 130 },
  { id: 'serv-vazamento', categoria: 'Hidráulica', descricao: 'Correção de vazamento simples', horas: 2, valorHora: 120 },
  { id: 'serv-torneira', categoria: 'Hidráulica', descricao: 'Troca de torneira', horas: 1, valorHora: 95 },
  { id: 'serv-sifao', categoria: 'Hidráulica', descricao: 'Troca de sifão ou flexível', horas: 1, valorHora: 85 },
  { id: 'serv-desentupimento', categoria: 'Hidráulica', descricao: 'Desentupimento simples', horas: 2, valorHora: 130 },
  { id: 'serv-pintura-m2', categoria: 'Pintura', descricao: 'Pintura de parede por m²', horas: 1, valorHora: 38 },
  { id: 'serv-massa-m2', categoria: 'Pintura', descricao: 'Aplicação de massa corrida por m²', horas: 1, valorHora: 42 },
  { id: 'serv-acabamento', categoria: 'Acabamento', descricao: 'Assentamento/acabamento por m²', horas: 1, valorHora: 85 },
  { id: 'serv-visita', categoria: 'Atendimento', descricao: 'Visita técnica com diagnóstico', horas: 1, valorHora: 120 },
  { id: 'serv-urgencia', categoria: 'Atendimento', descricao: 'Atendimento emergencial', horas: 1, valorHora: 180 },
];

export const catalogoPacotes = [
  {
    id: 'pac-chuveiro-basico',
    categoria: 'Elétrica',
    nome: 'Chuveiro - instalação básica',
    descricao: 'Instalação com troca de disjuntor e acabamento simples.',
    materiais: [
      { nome: 'Chuveiro elétrico 220V', qtd: 1, precoVenda: 249.9, custo: 185 },
      { nome: 'Disjuntor bipolar 32A', qtd: 1, precoVenda: 58.9, custo: 41.5 },
      { nome: 'Fita isolante antichama', qtd: 1, precoVenda: 11.9, custo: 7.4 },
    ],
    servicos: [
      { descricao: 'Instalação de chuveiro elétrico', horas: 1, valorHora: 140 },
    ],
  },
  {
    id: 'pac-tomada-completa',
    categoria: 'Elétrica',
    nome: 'Novo ponto de tomada',
    descricao: 'Material e mão de obra para adicionar um ponto completo.',
    materiais: [
      { nome: 'Tomada 10A com placa', qtd: 1, precoVenda: 22.9, custo: 14.2 },
      { nome: 'Cabo flexível 2,5mm', qtd: 10, precoVenda: 5.9, custo: 3.8 },
      { nome: 'Fita isolante antichama', qtd: 1, precoVenda: 11.9, custo: 7.4 },
    ],
    servicos: [
      { descricao: 'Instalação de ponto de tomada', horas: 2, valorHora: 95 },
    ],
  },
  {
    id: 'pac-banheiro-vazamento',
    categoria: 'Hidráulica',
    nome: 'Reparo hidráulico simples',
    descricao: 'Troca de componentes comuns e correção de vazamento leve.',
    materiais: [
      { nome: 'Sifão flexível universal', qtd: 1, precoVenda: 24.9, custo: 14.9 },
      { nome: 'Fita veda rosca', qtd: 1, precoVenda: 7.9, custo: 4.2 },
      { nome: 'Registro esfera 1/2"', qtd: 1, precoVenda: 36.9, custo: 24.5 },
    ],
    servicos: [
      { descricao: 'Correção de vazamento simples', horas: 2, valorHora: 120 },
    ],
  },
  {
    id: 'pac-pintura-comodo',
    categoria: 'Pintura',
    nome: 'Pintura de cômodo padrão',
    descricao: 'Materiais e mão de obra para pintura residencial rápida.',
    materiais: [
      { nome: 'Tinta acrílica premium 3,6L', qtd: 1, precoVenda: 149.9, custo: 109 },
      { nome: 'Rolo de pintura anti respingo', qtd: 1, precoVenda: 27.9, custo: 17.5 },
      { nome: 'Fita crepe para acabamento', qtd: 1, precoVenda: 12.9, custo: 7.8 },
    ],
    servicos: [
      { descricao: 'Pintura de parede por m²', horas: 8, valorHora: 38 },
    ],
  },
];

const mergeById = (items, overridesById = {}) => {
  return items.map((item) => ({
    ...item,
    ...(overridesById[item.id] || {}),
  }));
};

const applyPackageOverrides = (packages, overridesById = {}) => {
  return packages.map((pacote) => ({
    ...pacote,
    ...(overridesById[pacote.id] || {}),
  }));
};

export function applyCatalogOverrides({ materiais, servicos, pacotes }, overrides = {}) {
  return {
    materiais: mergeById(materiais, overrides.materiais),
    servicos: mergeById(servicos, overrides.servicos),
    pacotes: applyPackageOverrides(pacotes, overrides.pacotes),
  };
}

export function buildCatalogOverridePayload(type, item, changes) {
  const allowedFieldsByType = {
    materiais: ['precoVenda', 'custo', 'qtd'],
    servicos: ['valorHora', 'horas'],
    pacotes: ['nome', 'descricao'],
  };

  return allowedFieldsByType[type].reduce((payload, field) => {
    if (Object.hasOwn(changes, field)) {
      payload[field] = Number.isFinite(Number(changes[field])) && field !== 'nome' && field !== 'descricao'
        ? Number(changes[field])
        : changes[field];
    }

    return payload;
  }, { id: item.id, updated_at: new Date().toISOString() });
}
