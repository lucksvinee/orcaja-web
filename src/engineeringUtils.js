export const DEFAULT_ENGINEERING_DETAILS = {
  enabled: false,
  work_type: 'obra',
  object: '',
  location: '',
  requester: '',
  responsible_name: '',
  professional_registry: '',
  date_base: '',
  reference_source: 'SINAPI',
  reference_uf: 'RJ',
  reference_month: '',
  global_bdi: 0,
  default_stage: '',
  tax_notes: '',
  technical_notes: '',
  schedule: [],
  measurements: [],
};

export const ENGINEERING_WORK_TYPE_OPTIONS = [
  { value: 'obra', label: 'Obra' },
  { value: 'reforma', label: 'Reforma' },
  { value: 'manutencao', label: 'Manutencao' },
  { value: 'servico_tecnico', label: 'Servico tecnico' },
  { value: 'vistoria', label: 'Vistoria' },
];

export const ENGINEERING_PRICE_SOURCE_OPTIONS = [
  { value: 'SINAPI', label: 'SINAPI' },
  { value: 'SICRO', label: 'SICRO' },
  { value: 'Cotacao', label: 'Cotacao' },
  { value: 'Composicao propria', label: 'Composicao propria' },
  { value: 'Catalogo OrcaJa', label: 'Catalogo OrcaJa' },
];

export const ENGINEERING_UF_OPTIONS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS',
  'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC',
  'SE', 'SP', 'TO',
];

export const ENGINEERING_UNIT_OPTIONS = [
  'un', 'm', 'm2', 'm3', 'kg', 'h', 'dia', 'mes', 'vb',
];

const clampNumber = (value, min = 0, max = 1000000000) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return min;
  return Math.min(max, Math.max(min, numberValue));
};

const sanitizeText = (value, limit = 300) => String(value || '').trim().slice(0, limit);

const normalizeSchedule = (schedule = []) => {
  if (!Array.isArray(schedule)) return [];

  return schedule.slice(0, 36).map((stage, index) => ({
    id: stage.id || index + 1,
    etapa: sanitizeText(stage.etapa || `Etapa ${index + 1}`, 120),
    periodo: sanitizeText(stage.periodo, 80),
    percentual: clampNumber(stage.percentual, 0, 100),
  }));
};

const normalizeMeasurements = (measurements = []) => {
  if (!Array.isArray(measurements)) return [];

  return measurements.slice(0, 80).map((measurement, index) => ({
    id: measurement.id || index + 1,
    data: sanitizeText(measurement.data, 32),
    etapa: sanitizeText(measurement.etapa || `Medicao ${index + 1}`, 120),
    percentual: clampNumber(measurement.percentual, 0, 100),
    valor: clampNumber(measurement.valor, 0),
    observacao: sanitizeText(measurement.observacao, 280),
  }));
};

export function normalizeEngineeringDetails(details = {}) {
  const source = details || {};

  return {
    ...DEFAULT_ENGINEERING_DETAILS,
    ...source,
    enabled: Boolean(source.enabled),
    work_type: ENGINEERING_WORK_TYPE_OPTIONS.some(option => option.value === source.work_type)
      ? source.work_type
      : DEFAULT_ENGINEERING_DETAILS.work_type,
    object: sanitizeText(source.object, 180),
    location: sanitizeText(source.location, 180),
    requester: sanitizeText(source.requester, 120),
    responsible_name: sanitizeText(source.responsible_name, 120),
    professional_registry: sanitizeText(source.professional_registry, 80),
    date_base: sanitizeText(source.date_base, 32),
    reference_source: sanitizeText(source.reference_source || DEFAULT_ENGINEERING_DETAILS.reference_source, 80),
    reference_uf: ENGINEERING_UF_OPTIONS.includes(source.reference_uf)
      ? source.reference_uf
      : DEFAULT_ENGINEERING_DETAILS.reference_uf,
    reference_month: sanitizeText(source.reference_month, 32),
    global_bdi: clampNumber(source.global_bdi, 0, 100),
    default_stage: sanitizeText(source.default_stage, 120),
    tax_notes: sanitizeText(source.tax_notes, 300),
    technical_notes: sanitizeText(source.technical_notes, 600),
    schedule: normalizeSchedule(source.schedule),
    measurements: normalizeMeasurements(source.measurements),
  };
}

export function getEngineeringWorkTypeLabel(value) {
  return ENGINEERING_WORK_TYPE_OPTIONS.find(option => option.value === value)?.label || 'Obra';
}

export function getItemBdiRate(item = {}, engineeringDetails = {}) {
  const details = normalizeEngineeringDetails(engineeringDetails);
  if (!details.enabled) return 0;

  if (item.bdi_rate !== undefined && item.bdi_rate !== null && item.bdi_rate !== '') {
    return clampNumber(item.bdi_rate, 0, 100);
  }

  return details.global_bdi;
}

export function getLineBaseTotal(item = {}, quantityKey, priceKey) {
  return clampNumber(item[quantityKey], 0) * clampNumber(item[priceKey], 0);
}

export function getLineBdiValue(item = {}, quantityKey, priceKey, engineeringDetails = {}) {
  const baseTotal = getLineBaseTotal(item, quantityKey, priceKey);
  return baseTotal * (getItemBdiRate(item, engineeringDetails) / 100);
}

export function getLineTotalWithBdi(item = {}, quantityKey, priceKey, engineeringDetails = {}) {
  return getLineBaseTotal(item, quantityKey, priceKey) + getLineBdiValue(item, quantityKey, priceKey, engineeringDetails);
}

export function getEngineeringLineItems(materiais = [], servicos = [], engineeringDetails = {}) {
  const details = normalizeEngineeringDetails(engineeringDetails);
  const buildLine = (item, type, index) => {
    const quantityKey = type === 'material' ? 'qtd' : 'horas';
    const priceKey = type === 'material' ? 'precoVenda' : 'valorHora';
    const description = type === 'material' ? item.nome : item.descricao;
    const baseTotal = getLineBaseTotal(item, quantityKey, priceKey);
    const bdiRate = getItemBdiRate(item, details);
    const bdiValue = getLineBdiValue(item, quantityKey, priceKey, details);

    return {
      id: item.id || `${type}-${index}`,
      type,
      type_label: type === 'material' ? 'Material' : 'Servico',
      description: sanitizeText(description || '', 220),
      quantity: clampNumber(item[quantityKey], 0),
      unit: sanitizeText(item.unidade || (type === 'material' ? 'un' : 'h'), 20),
      unit_price: clampNumber(item[priceKey], 0),
      base_total: baseTotal,
      bdi_rate: bdiRate,
      bdi_value: bdiValue,
      total: baseTotal + bdiValue,
      source: sanitizeText(item.fonte, 80),
      code: sanitizeText(item.codigo, 60),
      memory: sanitizeText(item.memoria_calculo, 280),
      stage: sanitizeText(item.etapa || details.default_stage || 'Sem etapa', 120),
    };
  };

  return [
    ...materiais.map((item, index) => buildLine(item, 'material', index)),
    ...servicos.map((item, index) => buildLine(item, 'servico', index)),
  ].filter(line => line.description && line.total > 0);
}

export function buildAbcCurve(lines = []) {
  const totalBudget = lines.reduce((acc, line) => acc + Number(line.total || 0), 0);
  let cumulative = 0;

  return [...lines]
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
    .map((line, index) => {
      const participation = totalBudget ? (Number(line.total || 0) / totalBudget) * 100 : 0;
      cumulative += participation;

      return {
        ...line,
        rank: index + 1,
        participation,
        cumulative,
        abc_class: cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C',
      };
    });
}

export function getStageSummary(lines = []) {
  const totalBudget = lines.reduce((acc, line) => acc + Number(line.total || 0), 0);
  const grouped = lines.reduce((acc, line) => {
    const stage = line.stage || 'Sem etapa';
    acc[stage] ||= {
      stage,
      materials: 0,
      services: 0,
      total: 0,
      items: 0,
    };

    acc[stage].items += 1;
    acc[stage].total += Number(line.total || 0);
    if (line.type === 'material') {
      acc[stage].materials += Number(line.total || 0);
    } else {
      acc[stage].services += Number(line.total || 0);
    }

    return acc;
  }, {});

  return Object.values(grouped)
    .map(stage => ({
      ...stage,
      participation: totalBudget ? (stage.total / totalBudget) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getScheduleTotalPercent(schedule = []) {
  return normalizeSchedule(schedule).reduce((acc, stage) => acc + Number(stage.percentual || 0), 0);
}

export function getMeasurementsTotal(measurements = []) {
  return normalizeMeasurements(measurements).reduce((acc, measurement) => acc + Number(measurement.valor || 0), 0);
}

export function isEngineeringDateBaseStale(dateBase, now = new Date()) {
  if (!dateBase) return false;
  const parsed = new Date(dateBase);
  if (Number.isNaN(parsed.getTime())) return false;

  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return parsed.getTime() < sixMonthsAgo.getTime();
}

export function getEngineeringAudit({ details = {}, materiais = [], maoDeObra = [], totals = {} } = {}) {
  const engineeringDetails = normalizeEngineeringDetails(details);
  if (!engineeringDetails.enabled) return [];

  const lines = getEngineeringLineItems(materiais, maoDeObra, engineeringDetails);
  const schedulePercent = getScheduleTotalPercent(engineeringDetails.schedule);
  const measuredTotal = getMeasurementsTotal(engineeringDetails.measurements);
  const budgetTotal = Number(totals.totalGeral || 0);
  const issues = [];
  const addIssue = (severity, title, message) => issues.push({ severity, title, message });

  if (!lines.length) {
    addIssue('critical', 'Orcamento sem itens', 'Adicione materiais, servicos ou composicoes antes de entregar.');
  }

  if (!engineeringDetails.object) {
    addIssue('warning', 'Objeto nao informado', 'Defina o objeto do orcamento para deixar a entrega tecnica rastreavel.');
  }

  if (!engineeringDetails.responsible_name || !engineeringDetails.professional_registry) {
    addIssue('warning', 'Responsavel incompleto', 'Informe responsavel tecnico e CREA/CAU para relatorio profissional.');
  }

  if (!engineeringDetails.date_base && !engineeringDetails.reference_month) {
    addIssue('warning', 'Sem data-base', 'Registre a competencia da tabela de precos usada.');
  } else if (isEngineeringDateBaseStale(engineeringDetails.date_base)) {
    addIssue('warning', 'Data-base antiga', 'Revise os precos antes de enviar uma proposta tecnica.');
  }

  const missingSourceCount = lines.filter(line => !line.source).length;
  if (missingSourceCount > 0) {
    addIssue('critical', 'Itens sem fonte', `${missingSourceCount} item(ns) nao informam SINAPI, cotacao ou composicao propria.`);
  }

  const missingMemoryCount = lines.filter(line => !line.memory).length;
  if (missingMemoryCount > 0) {
    addIssue('info', 'Memoria incompleta', `${missingMemoryCount} item(ns) ainda nao explicam o quantitativo.`);
  }

  const officialWithoutCodeCount = lines.filter(line => ['SINAPI', 'SICRO'].includes(line.source) && !line.code).length;
  if (officialWithoutCodeCount > 0) {
    addIssue('warning', 'Referencia sem codigo', `${officialWithoutCodeCount} item(ns) oficiais estao sem codigo de composicao/insumo.`);
  }

  const hasAnyBdi = engineeringDetails.global_bdi > 0 || lines.some(line => line.bdi_rate > 0);
  if (!hasAnyBdi && budgetTotal > 0) {
    addIssue('info', 'BDI zerado', 'Confirme se o preco final deve sair sem BDI.');
  }

  if (!engineeringDetails.schedule.length) {
    addIssue('info', 'Sem cronograma', 'Adicionar cronograma fisico-financeiro aumenta a percepcao profissional da entrega.');
  } else if (Math.abs(schedulePercent - 100) > 0.5) {
    addIssue('warning', 'Cronograma fora de 100%', `A distribuicao atual esta em ${schedulePercent.toFixed(2).replace('.', ',')}%.`);
  }

  if (budgetTotal > 0 && measuredTotal > budgetTotal) {
    addIssue('critical', 'Medicoes acima do total', 'O valor medido ultrapassa o total do orcamento.');
  }

  return issues;
}

export function getEngineeringHealthScore(issues = []) {
  const penalties = {
    critical: 24,
    warning: 13,
    info: 6,
  };

  const score = issues.reduce((acc, issue) => acc - (penalties[issue.severity] || 0), 100);
  return Math.max(0, Math.min(100, score));
}

const normalizeHeader = (header) => String(header || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const detectDelimiter = (line) => {
  const delimiters = [';', ',', '\t'];
  return delimiters.reduce((best, delimiter) => {
    const count = line.split(delimiter).length;
    return count > best.count ? { delimiter, count } : best;
  }, { delimiter: ';', count: 0 }).delimiter;
};

const splitCsvLine = (line, delimiter) => {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

const parseCurrencyNumber = (value) => {
  const rawValue = String(value || '')
    .replace(/\s/g, '')
    .replace(/[R$]/g, '');
  const cleanValue = rawValue.includes(',')
    ? rawValue.replace(/\./g, '').replace(',', '.')
    : rawValue;

  return clampNumber(cleanValue, 0);
};

export function parseSinapiCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
  const indexOf = (...names) => headers.findIndex(header => names.includes(header));
  const codeIndex = indexOf('codigo', 'codigosinapi', 'codigocomposicao', 'codigodacomposicao', 'codigodoinsumo', 'codigodoitem');
  const descriptionIndex = indexOf('descricao', 'descricaodoitem', 'descricaodacomposicao', 'descricaodoinsumo', 'insumo', 'composicao');
  const unitIndex = indexOf('unidade', 'un', 'unidademedida');
  const priceIndex = indexOf('preco', 'precomediano', 'precoinsumo', 'custototal', 'custo', 'valor', 'precofinal');

  return lines.slice(1, 1001).map((line, index) => {
    const values = splitCsvLine(line, delimiter);
    const codigo = sanitizeText(values[codeIndex], 40);
    const descricao = sanitizeText(values[descriptionIndex], 220);
    const unidade = sanitizeText(values[unitIndex], 20) || 'un';
    const preco = parseCurrencyNumber(values[priceIndex]);

    return {
      id: `sinapi-${codigo || index}`,
      codigo,
      descricao,
      unidade,
      preco,
      fonte: 'SINAPI',
    };
  }).filter(item => item.descricao && item.preco > 0);
}
