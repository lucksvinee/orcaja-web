export const ORCAMENTO_STATUS = {
  draft: 'rascunho',
  sent: 'enviado',
  viewed: 'visualizado',
  approved: 'aprovado',
  rejected: 'recusado',
  completed: 'concluído',
};

export const ORCAMENTO_STATUS_OPTIONS = [
  { value: ORCAMENTO_STATUS.draft, label: 'Rascunho' },
  { value: ORCAMENTO_STATUS.sent, label: 'Enviado' },
  { value: ORCAMENTO_STATUS.viewed, label: 'Visualizado' },
  { value: ORCAMENTO_STATUS.approved, label: 'Aprovado' },
  { value: ORCAMENTO_STATUS.rejected, label: 'Recusado' },
  { value: ORCAMENTO_STATUS.completed, label: 'Concluído' },
];

const LEGACY_STATUS_MAP = {
  pendente: ORCAMENTO_STATUS.draft,
  rejeitado: ORCAMENTO_STATUS.rejected,
  concluido: ORCAMENTO_STATUS.completed,
};

export function normalizeOrcamentoStatus(status) {
  const normalized = LEGACY_STATUS_MAP[status] || status || ORCAMENTO_STATUS.draft;
  return ORCAMENTO_STATUS_OPTIONS.some(option => option.value === normalized)
    ? normalized
    : ORCAMENTO_STATUS.draft;
}

export function getOrcamentoStatusLabel(status) {
  const normalized = normalizeOrcamentoStatus(status);
  return ORCAMENTO_STATUS_OPTIONS.find(option => option.value === normalized)?.label || 'Rascunho';
}

export function getOrcamentoStatusClass(status) {
  const normalized = normalizeOrcamentoStatus(status);

  if (normalized === ORCAMENTO_STATUS.approved) return 'bg-emerald-100 text-emerald-700';
  if (normalized === ORCAMENTO_STATUS.rejected) return 'bg-red-100 text-red-700';
  if (normalized === ORCAMENTO_STATUS.completed) return 'bg-blue-100 text-blue-700';
  if (normalized === ORCAMENTO_STATUS.sent) return 'bg-indigo-100 text-indigo-700';
  if (normalized === ORCAMENTO_STATUS.viewed) return 'bg-cyan-100 text-cyan-700';
  return 'bg-amber-100 text-amber-700';
}
