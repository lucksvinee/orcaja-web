import { ORCAMENTO_STATUS, normalizeOrcamentoStatus } from './orcamentoStatus';

export const DEFAULT_ACCENT_COLOR = '#2563eb';

export const DEFAULT_COMPANY_TERMS = [
  'Orçamento válido por 15 dias.',
  'Condições de pagamento a combinar.',
  'Valores sujeitos a alteração sem aviso prévio.',
].join('\n');

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
