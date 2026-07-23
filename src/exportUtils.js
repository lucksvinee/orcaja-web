import { getOrcamentoStatusLabel } from './orcamentoStatus';
import { getMeasurementsTotal, normalizeEngineeringDetails } from './engineeringUtils';
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
