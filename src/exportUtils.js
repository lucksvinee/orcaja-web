import { getOrcamentoStatusLabel } from './orcamentoStatus';

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
  return orcamentos.map(orcamento => ({
    id: orcamento.id,
    numero: orcamento.numero || '',
    status: getOrcamentoStatusLabel(orcamento.status),
    cliente: orcamento.cliente?.nome || '',
    telefone_cliente: orcamento.cliente?.telefone || '',
    total: formatCurrency(orcamento.total),
    materiais: (orcamento.itens || []).length,
    servicos: (orcamento.servicos || []).length,
    criado_em: formatDate(orcamento.created_at),
    atualizado_em: formatDate(orcamento.updated_at),
  }));
}
