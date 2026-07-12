export const PROFESSIONAL_TEMPLATES = [
  {
    id: 'eletrica-residencial',
    label: 'Elétrica',
    title: 'Manutenção elétrica residencial',
    description: 'Ponto de tomada, revisão simples e materiais comuns para começar rápido.',
    materiais: [
      { nome: 'Cabo flexível 2,5mm', qtd: 20, precoVenda: 5.9, custo: 3.8 },
      { nome: 'Tomada 10A com placa', qtd: 2, precoVenda: 22.9, custo: 14.2 },
      { nome: 'Caixa 4x2 embutir', qtd: 2, precoVenda: 8.9, custo: 5.4 },
      { nome: 'Fita isolante antichama', qtd: 1, precoVenda: 11.9, custo: 7.4 },
    ],
    servicos: [
      { descricao: 'Instalação de ponto de tomada', horas: 3, valorHora: 95 },
    ],
    terms: [
      'Orçamento válido por 15 dias.',
      'Execução mediante disponibilidade de agenda.',
      'Materiais adicionais serão aprovados antes da cobrança.',
    ].join('\n'),
  },
  {
    id: 'hidraulica-reparo',
    label: 'Hidráulica',
    title: 'Reparo hidráulico simples',
    description: 'Troca de sifão/flexível, vedação e correção de vazamento leve.',
    materiais: [
      { nome: 'Sifão flexível universal', qtd: 1, precoVenda: 24.9, custo: 14.9 },
      { nome: 'Fita veda rosca', qtd: 1, precoVenda: 7.9, custo: 4.2 },
      { nome: 'Registro esfera 1/2"', qtd: 1, precoVenda: 36.9, custo: 24.5 },
    ],
    servicos: [
      { descricao: 'Correção de vazamento simples', horas: 2, valorHora: 120 },
    ],
    terms: [
      'Orçamento válido por 15 dias.',
      'Peças fora do escopo serão informadas antes da troca.',
      'Garantia sobre a mão de obra conforme avaliação do serviço.',
    ].join('\n'),
  },
  {
    id: 'pintura-comodo',
    label: 'Pintura',
    title: 'Pintura de cômodo padrão',
    description: 'Base para pintura rápida com tinta, rolo, fita e mão de obra.',
    materiais: [
      { nome: 'Tinta acrílica premium 3,6L', qtd: 1, precoVenda: 149.9, custo: 109 },
      { nome: 'Rolo de pintura anti respingo', qtd: 1, precoVenda: 27.9, custo: 17.5 },
      { nome: 'Fita crepe para acabamento', qtd: 2, precoVenda: 12.9, custo: 7.8 },
      { nome: 'Massa corrida 5,5kg', qtd: 1, precoVenda: 42.9, custo: 29 },
    ],
    servicos: [
      { descricao: 'Pintura de parede por m²', horas: 8, valorHora: 38 },
    ],
    terms: [
      'Orçamento válido por 15 dias.',
      'Ambiente deve estar liberado para execução.',
      'Retoques fora do escopo serão combinados previamente.',
    ].join('\n'),
  },
  {
    id: 'marcenaria-ajuste',
    label: 'Marcenaria',
    title: 'Ajuste e reparo de móveis',
    description: 'Modelo para pequenos reparos, dobradiças, puxadores e regulagens.',
    materiais: [
      { nome: 'Dobradiça reta 35mm', qtd: 4, precoVenda: 18.9, custo: 11.5 },
      { nome: 'Parafusos para madeira', qtd: 1, precoVenda: 14.9, custo: 8.5 },
      { nome: 'Puxador simples', qtd: 2, precoVenda: 24.9, custo: 15 },
    ],
    servicos: [
      { descricao: 'Ajuste e reparo de móvel planejado', horas: 3, valorHora: 120 },
    ],
    terms: [
      'Orçamento válido por 15 dias.',
      'Medidas finais devem ser confirmadas no local.',
      'Peças especiais podem alterar prazo e valor.',
    ].join('\n'),
  },
];
