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
