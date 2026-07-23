import { getOrcamentoStatusLabel } from './orcamentoStatus';
import {
  buildAbcCurve,
  getEngineeringLineItems,
  getMeasurementsTotal,
  getStageSummary,
  normalizeEngineeringDetails,
} from './engineeringUtils';
import { calculateOrcamentoTotals } from './orcamentoUtils';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
};

const formatCurrency = (value) => Number(value || 0).toFixed(2).replace('.', ',');

const escapeCsvValue = (value) => {
  const text = String(value ?? '');
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
};

export function downloadCsv(filename, rows) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const content = [
    headers.map(escapeCsvValue).join(';'),
    ...rows.map(row => headers.map(header => escapeCsvValue(row[header])).join(';')),
  ].join('\n');

  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function buildClientesCsvRows(clientes = []) {
  return clientes.map(cliente => ({
    id: cliente.id,
    nome: cliente.nome || '',
    email: cliente.email || '',
    telefone: cliente.telefone || '',
    endereco: cliente.endereco || '',
    cadastrado_em: formatDate(cliente.created_at),
  }));
}

export function buildOrcamentosCsvRows(orcamentos = []) {
  return orcamentos.map((orcamento) => {
    const engineering = normalizeEngineeringDetails(orcamento.engineering || {});
    const totals = calculateOrcamentoTotals(orcamento.itens || [], orcamento.servicos || [], engineering);

    return {
      id: orcamento.id,
      numero: orcamento.numero || '',
      status: getOrcamentoStatusLabel(orcamento.status),
      cliente: orcamento.cliente?.nome || '',
      telefone_cliente: orcamento.cliente?.telefone || '',
      modo: engineering.enabled ? 'Engenharia' : 'Rapido',
      objeto: engineering.object,
      local_obra: engineering.location,
      solicitante: engineering.requester,
      responsavel_tecnico: engineering.responsible_name,
      registro_profissional: engineering.professional_registry,
      fonte_precos: engineering.reference_source,
      uf_referencia: engineering.reference_uf,
      data_base: engineering.date_base,
      bdi_percentual: engineering.global_bdi,
      subtotal: formatCurrency(totals.subtotalGeral),
      bdi_total: formatCurrency(totals.totalBdi),
      total: formatCurrency(orcamento.total || totals.totalGeral),
      total_medido: formatCurrency(getMeasurementsTotal(engineering.measurements)),
      materiais: (orcamento.itens || []).length,
      servicos: (orcamento.servicos || []).length,
      revisoes: orcamento.revision_count || 0,
      criado_em: formatDate(orcamento.created_at),
      atualizado_em: formatDate(orcamento.updated_at),
    };
  });
}

const buildTechnicalCsvRow = (row = {}) => ({
  aba: '',
  tipo: '',
  grupo: '',
  codigo: '',
  descricao: '',
  unidade: '',
  quantidade: '',
  valor_unitario: '',
  subtotal: '',
  bdi_percentual: '',
  bdi_valor: '',
  total: '',
  participacao: '',
  acumulado: '',
  classe: '',
  periodo: '',
  percentual: '',
  valor_previsto: '',
  valor_medido: '',
  observacao: '',
  ...row,
});

export function buildTechnicalBudgetCsvRows({
  orcamento = {},
  cliente = {},
  materiais = [],
  servicos = [],
  engineering = {},
  totals,
} = {}) {
  const engineeringDetails = normalizeEngineeringDetails(engineering);
  const calculatedTotals = totals || calculateOrcamentoTotals(materiais, servicos, engineeringDetails);
  const lines = getEngineeringLineItems(materiais, servicos, engineeringDetails);
  const abcCurve = buildAbcCurve(lines);
  const stageSummary = getStageSummary(lines);
  const budgetTotal = Number(calculatedTotals.totalGeral || 0);

  return [
    buildTechnicalCsvRow({
      aba: 'Resumo',
      tipo: 'Orcamento',
      codigo: orcamento.numero || orcamento.id || '',
      descricao: getOrcamentoStatusLabel(orcamento.status),
      total: formatCurrency(budgetTotal),
    }),
    buildTechnicalCsvRow({
      aba: 'Resumo',
      tipo: 'Cliente',
      descricao: cliente.nome || '',
      observacao: cliente.telefone || '',
    }),
    buildTechnicalCsvRow({
      aba: 'Resumo',
      tipo: 'Objeto',
      descricao: engineeringDetails.object,
      observacao: engineeringDetails.location,
    }),
    buildTechnicalCsvRow({
      aba: 'Resumo',
      tipo: 'Responsavel tecnico',
      descricao: engineeringDetails.responsible_name,
      observacao: engineeringDetails.professional_registry,
    }),
    buildTechnicalCsvRow({
      aba: 'Resumo',
      tipo: 'Fonte',
      descricao: [engineeringDetails.reference_source, engineeringDetails.reference_uf, engineeringDetails.reference_month || engineeringDetails.date_base].filter(Boolean).join(' / '),
    }),
    buildTechnicalCsvRow({
      aba: 'Resumo',
      tipo: 'Totais',
      subtotal: formatCurrency(calculatedTotals.subtotalGeral),
      bdi_percentual: engineeringDetails.global_bdi,
      bdi_valor: formatCurrency(calculatedTotals.totalBdi),
      total: formatCurrency(budgetTotal),
    }),
    ...lines.map(line => buildTechnicalCsvRow({
      aba: 'Itens',
      tipo: line.type_label,
      grupo: line.stage,
      codigo: line.code,
      descricao: line.description,
      unidade: line.unit,
      quantidade: line.quantity,
      valor_unitario: formatCurrency(line.unit_price),
      subtotal: formatCurrency(line.base_total),
      bdi_percentual: line.bdi_rate,
      bdi_valor: formatCurrency(line.bdi_value),
      total: formatCurrency(line.total),
      observacao: [line.source, line.memory].filter(Boolean).join(' | '),
    })),
    ...abcCurve.map(line => buildTechnicalCsvRow({
      aba: 'Curva ABC',
      tipo: line.type_label,
      grupo: line.stage,
      codigo: line.code,
      descricao: line.description,
      total: formatCurrency(line.total),
      participacao: line.participation.toFixed(2).replace('.', ','),
      acumulado: line.cumulative.toFixed(2).replace('.', ','),
      classe: line.abc_class,
      observacao: line.source,
    })),
    ...stageSummary.map(stage => buildTechnicalCsvRow({
      aba: 'Etapas',
      grupo: stage.stage,
      descricao: `${stage.items} item(ns)`,
      subtotal: formatCurrency(stage.total),
      participacao: stage.participation.toFixed(2).replace('.', ','),
      total: formatCurrency(stage.total),
    })),
    ...engineeringDetails.schedule.map(stage => buildTechnicalCsvRow({
      aba: 'Cronograma',
      grupo: stage.etapa,
      periodo: stage.periodo,
      percentual: stage.percentual,
      valor_previsto: formatCurrency(budgetTotal * (Number(stage.percentual || 0) / 100)),
    })),
    ...engineeringDetails.measurements.map(measurement => buildTechnicalCsvRow({
      aba: 'Medicoes',
      grupo: measurement.etapa,
      periodo: formatDate(measurement.data),
      percentual: measurement.percentual,
      valor_medido: formatCurrency(measurement.valor),
      observacao: measurement.observacao,
    })),
  ];
}
