import { ORCAMENTO_STATUS, normalizeOrcamentoStatus } from './orcamentoStatus';

export const DEFAULT_ACCENT_COLOR = '#2563eb';

export const DEFAULT_COMPANY_TERMS = [
  'Orçamento válido por 15 dias.',
  'Condições de pagamento a combinar.',
  'Valores sujeitos a alteração sem aviso prévio.',
].join('\n');

export const DEFAULT_PAYMENT_DETAILS = {
  method: 'a_combinar',
  down_payment: 0,
  installments: 1,
  notes: '',
};

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'a_combinar', label: 'A combinar' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'entrada_restante', label: 'Entrada + restante' },
  { value: 'parcelado', label: 'Parcelado' },
];

const STATUS_PRIORITY = {
  [ORCAMENTO_STATUS.draft]: 0,
  [ORCAMENTO_STATUS.sent]: 1,
  [ORCAMENTO_STATUS.viewed]: 2,
  [ORCAMENTO_STATUS.rejected]: 3,
  [ORCAMENTO_STATUS.approved]: 4,
  [ORCAMENTO_STATUS.completed]: 5,
};

export function createShareToken() {
  if (typeof crypto !== 'undefined') {
    if (crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }

    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function buildPublicOrcamentoUrl(token) {
  return `${window.location.origin}/proposta/${token}`;
}

export function getMostAdvancedStatus(localStatus, publicStatus) {
  const local = normalizeOrcamentoStatus(localStatus);
  const remote = normalizeOrcamentoStatus(publicStatus);
  return STATUS_PRIORITY[remote] > STATUS_PRIORITY[local] ? remote : local;
}

export function sanitizeHexColor(value, fallback = DEFAULT_ACCENT_COLOR) {
  return /^#[0-9A-Fa-f]{6}$/.test(value || '') ? value : fallback;
}

export function hexToRgb(value, fallback = DEFAULT_ACCENT_COLOR) {
  const hex = sanitizeHexColor(value, fallback).replace('#', '');
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

export function getDefaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 15);
  return date.toISOString();
}

export function normalizePaymentDetails(payment = {}) {
  const method = PAYMENT_METHOD_OPTIONS.some(option => option.value === payment.method)
    ? payment.method
    : DEFAULT_PAYMENT_DETAILS.method;
  const downPayment = Math.max(0, Number(payment.down_payment || 0));
  const installments = Math.max(1, Math.min(24, Number(payment.installments || 1)));

  return {
    ...DEFAULT_PAYMENT_DETAILS,
    ...payment,
    method,
    down_payment: downPayment,
    installments,
    notes: String(payment.notes || '').slice(0, 280),
  };
}

export function getPaymentMethodLabel(method) {
  return PAYMENT_METHOD_OPTIONS.find(option => option.value === method)?.label || 'A combinar';
}

export function buildPaymentDescription(payment = {}, total = 0, formatter) {
  const normalized = normalizePaymentDetails(payment);
  const formatMoney = formatter || ((value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`);
  const totalValue = Number(total || 0);

  if (normalized.method === 'pix') {
    return 'Pagamento via PIX.';
  }

  if (normalized.method === 'cartao') {
    return normalized.installments > 1
      ? `Pagamento no cartão em até ${normalized.installments}x de ${formatMoney(totalValue / normalized.installments)}.`
      : 'Pagamento no cartão.';
  }

  if (normalized.method === 'entrada_restante') {
    const remaining = Math.max(0, totalValue - normalized.down_payment);
    return `Entrada de ${formatMoney(normalized.down_payment)} e restante de ${formatMoney(remaining)} na conclusão.`;
  }

  if (normalized.method === 'parcelado') {
    return `${normalized.installments} parcelas de ${formatMoney(totalValue / normalized.installments)}.`;
  }

  return 'Forma de pagamento a combinar.';
}
