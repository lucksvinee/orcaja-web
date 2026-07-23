export const ENGINEERING_MODULE_TABS = [
  { value: 'overview', label: 'Visão geral' },
  { value: 'projects', label: 'Obras e projetos' },
  { value: 'documents', label: 'Documentos' },
  { value: 'profile', label: 'Perfil técnico' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'templates', label: 'Modelos' },
  { value: 'team', label: 'Equipe' },
  { value: 'settings', label: 'Configurações' },
];

export const ENGINEERING_DOCUMENT_STATUS = {
  draft: 'rascunho',
  review: 'aguardando_revisao',
  returned: 'devolvido_para_correcao',
  revised: 'revisado',
  approved: 'aprovado',
  signed: 'assinado',
  delivered: 'entregue',
  archived: 'arquivado',
  cancelled: 'cancelado',
};

export const ENGINEERING_DOCUMENT_STATUS_OPTIONS = [
  { value: ENGINEERING_DOCUMENT_STATUS.draft, label: 'Rascunho' },
  { value: ENGINEERING_DOCUMENT_STATUS.review, label: 'Aguardando revisão' },
  { value: ENGINEERING_DOCUMENT_STATUS.returned, label: 'Devolvido para correção' },
  { value: ENGINEERING_DOCUMENT_STATUS.revised, label: 'Revisado' },
  { value: ENGINEERING_DOCUMENT_STATUS.approved, label: 'Aprovado' },
  { value: ENGINEERING_DOCUMENT_STATUS.signed, label: 'Assinado' },
  { value: ENGINEERING_DOCUMENT_STATUS.delivered, label: 'Entregue' },
  { value: ENGINEERING_DOCUMENT_STATUS.archived, label: 'Arquivado' },
  { value: ENGINEERING_DOCUMENT_STATUS.cancelled, label: 'Cancelado' },
];

export const LOCKED_DOCUMENT_STATUSES = [
  ENGINEERING_DOCUMENT_STATUS.approved,
  ENGINEERING_DOCUMENT_STATUS.signed,
  ENGINEERING_DOCUMENT_STATUS.delivered,
  ENGINEERING_DOCUMENT_STATUS.archived,
];

export const ENGINEERING_ACTIONS = [
  { type: 'vistoria', label: 'Nova vistoria', shortLabel: 'Vistoria', tone: 'blue' },
  { type: 'relatorio_tecnico', label: 'Novo relatório técnico', shortLabel: 'Relatório técnico', tone: 'slate' },
  { type: 'relatorio_fotografico', label: 'Novo relatório fotográfico', shortLabel: 'Fotográfico', tone: 'cyan' },
  { type: 'rdo', label: 'Novo RDO', shortLabel: 'RDO', tone: 'emerald' },
  { type: 'parecer_tecnico', label: 'Novo parecer técnico', shortLabel: 'Parecer', tone: 'amber' },
  { type: 'laudo_tecnico', label: 'Novo laudo', shortLabel: 'Laudo', tone: 'red' },
  { type: 'medicao', label: 'Nova medição', shortLabel: 'Medição', tone: 'indigo' },
  { type: 'memorial_descritivo', label: 'Novo memorial descritivo', shortLabel: 'Memorial', tone: 'violet' },
  { type: 'checklist', label: 'Novo checklist', shortLabel: 'Checklist', tone: 'green' },
  { type: 'nao_conformidade', label: 'Nova não conformidade', shortLabel: 'Não conformidade', tone: 'orange' },
  { type: 'acompanhamento_obra', label: 'Novo acompanhamento de obra', shortLabel: 'Acompanhamento', tone: 'sky' },
  { type: 'proposta_engenharia', label: 'Proposta de engenharia', shortLabel: 'Proposta', tone: 'blue' },
];

export const DOCUMENT_WIZARD_STEPS = [
  { id: 'type', label: 'Tipo' },
  { id: 'client', label: 'Cliente e projeto' },
  { id: 'inspection', label: 'Vistoria' },
  { id: 'findings', label: 'Constatações' },
  { id: 'photos', label: 'Fotografias' },
  { id: 'analysis', label: 'Análise' },
  { id: 'recommendations', label: 'Recomendações' },
  { id: 'review', label: 'Revisão' },
  { id: 'generate', label: 'Geração' },
];

export const DOCUMENT_BLOCK_LIBRARY = [
  { id: 'cover', label: 'Capa', required: true },
  { id: 'contractor', label: 'Identificação do contratante', required: true },
  { id: 'property', label: 'Identificação do imóvel ou obra', required: true },
  { id: 'professional', label: 'Responsável técnico', required: true },
  { id: 'object', label: 'Objeto' },
  { id: 'purpose', label: 'Finalidade' },
  { id: 'history', label: 'Histórico' },
  { id: 'methodology', label: 'Metodologia utilizada' },
  { id: 'inspection', label: 'Data e horário da vistoria' },
  { id: 'participants', label: 'Participantes' },
  { id: 'conditions', label: 'Condições encontradas' },
  { id: 'findings', label: 'Constatações' },
  { id: 'reported_information', label: 'Informações relatadas' },
  { id: 'hypothesis', label: 'Hipóteses técnicas' },
  { id: 'analysis', label: 'Análise técnica' },
  { id: 'photos', label: 'Registros fotográficos' },
  { id: 'budget', label: 'Resumo do orçamento' },
  { id: 'recommendations', label: 'Recomendações' },
  { id: 'limitations', label: 'Limitações da análise' },
  { id: 'art', label: 'Informações da ART' },
  { id: 'signature', label: 'Assinatura' },
];

export const DOCUMENT_TEMPLATES = [
  {
    id: 'vistoria',
    type: 'vistoria',
    title: 'Relatório de vistoria',
    description: 'Registro objetivo de visita técnica, condições encontradas, fotos e recomendações.',
    defaultPurpose: 'Registrar as condições observadas durante a vistoria técnica.',
    blocks: ['cover', 'contractor', 'property', 'professional', 'object', 'inspection', 'participants', 'findings', 'photos', 'recommendations', 'limitations', 'signature'],
  },
  {
    id: 'relatorio_tecnico',
    type: 'relatorio_tecnico',
    title: 'Relatório técnico',
    description: 'Documento técnico com objeto, metodologia, análise, conclusão e anexos.',
    defaultPurpose: 'Apresentar análise técnica a partir das informações e registros disponibilizados.',
    blocks: ['cover', 'contractor', 'property', 'professional', 'object', 'purpose', 'history', 'methodology', 'findings', 'analysis', 'photos', 'recommendations', 'limitations', 'art', 'signature'],
  },
  {
    id: 'relatorio_fotografico',
    type: 'relatorio_fotografico',
    title: 'Relatório fotográfico',
    description: 'Entrega rápida com fotos numeradas, legendas, ambiente e observação.',
    defaultPurpose: 'Organizar os registros fotográficos com identificação e legenda.',
    blocks: ['cover', 'contractor', 'property', 'professional', 'object', 'photos', 'signature'],
  },
  {
    id: 'rdo',
    type: 'rdo',
    title: 'Relatório Diário de Obra - RDO',
    description: 'Registro de atividades, clima, equipe, ocorrências e programação do próximo dia.',
    defaultPurpose: 'Registrar as atividades e ocorrências do dia de obra.',
    blocks: ['cover', 'property', 'professional', 'inspection', 'conditions', 'findings', 'photos', 'recommendations', 'signature'],
  },
  {
    id: 'parecer_tecnico',
    type: 'parecer_tecnico',
    title: 'Parecer técnico',
    description: 'Parecer objetivo com solicitação, análise, encaminhamento e conclusão.',
    defaultPurpose: 'Responder tecnicamente à solicitação recebida.',
    blocks: ['cover', 'contractor', 'property', 'professional', 'object', 'history', 'analysis', 'recommendations', 'limitations', 'art', 'signature'],
  },
  {
    id: 'laudo_tecnico',
    type: 'laudo_tecnico',
    title: 'Laudo técnico',
    description: 'Estrutura mais formal com limitações, ART, conclusão e assinatura.',
    defaultPurpose: 'Apresentar conclusão técnica revisada pelo profissional responsável.',
    blocks: ['cover', 'contractor', 'property', 'professional', 'object', 'purpose', 'methodology', 'findings', 'analysis', 'photos', 'recommendations', 'limitations', 'art', 'signature'],
  },
  {
    id: 'medicao',
    type: 'medicao',
    title: 'Relatório de medição',
    description: 'Registro de avanço físico-financeiro, medições e evidências.',
    defaultPurpose: 'Registrar avanço físico-financeiro e evidências da medição.',
    blocks: ['cover', 'contractor', 'property', 'professional', 'object', 'inspection', 'findings', 'budget', 'photos', 'signature'],
  },
  {
    id: 'memorial_descritivo',
    type: 'memorial_descritivo',
    title: 'Memorial descritivo',
    description: 'Descrição de objeto, critérios, materiais, serviços e condições de execução.',
    defaultPurpose: 'Descrever tecnicamente os serviços e critérios de execução.',
    blocks: ['cover', 'contractor', 'property', 'professional', 'object', 'methodology', 'analysis', 'budget', 'limitations', 'signature'],
  },
  {
    id: 'checklist',
    type: 'checklist',
    title: 'Checklist de inspeção',
    description: 'Lista objetiva de verificação com pendências e prioridades.',
    defaultPurpose: 'Registrar itens verificados, pendências e prioridade de ação.',
    blocks: ['cover', 'property', 'professional', 'inspection', 'findings', 'recommendations', 'signature'],
  },
  {
    id: 'nao_conformidade',
    type: 'nao_conformidade',
    title: 'Relatório de não conformidade',
    description: 'Registro de ocorrência, prioridade, risco e ação corretiva.',
    defaultPurpose: 'Formalizar não conformidade observada e encaminhamento recomendado.',
    blocks: ['cover', 'property', 'professional', 'findings', 'analysis', 'recommendations', 'photos', 'signature'],
  },
  {
    id: 'acompanhamento_obra',
    type: 'acompanhamento_obra',
    title: 'Relatório de acompanhamento de obra',
    description: 'Avanço, ocorrências, impedimentos, fotos e próximas ações.',
    defaultPurpose: 'Registrar acompanhamento técnico de execução da obra.',
    blocks: ['cover', 'property', 'professional', 'inspection', 'conditions', 'findings', 'budget', 'photos', 'recommendations', 'signature'],
  },
  {
    id: 'proposta_engenharia',
    type: 'proposta_engenharia',
    title: 'Proposta de serviços de engenharia',
    description: 'Proposta técnica e comercial vinculada a cliente, projeto e orçamento.',
    defaultPurpose: 'Apresentar escopo, condições técnicas e estimativa de custos.',
    blocks: ['cover', 'contractor', 'property', 'professional', 'object', 'methodology', 'budget', 'limitations', 'signature'],
  },
];

export const DEFAULT_PROFESSIONAL_PROFILE = {
  full_name: '',
  profession: 'Engenheiro Civil',
  specialty: '',
  crea_number: '',
  registration_state: 'RJ',
  cpf_cnpj: '',
  company_name: '',
  phone: '',
  email: '',
  professional_address: '',
  position: '',
  municipal_department: '',
  intro_text: '',
  footer_text: '',
  show_fields: {
    cpf_cnpj: false,
    phone: true,
    email: true,
    address: false,
    registration: true,
  },
};

export const DEFAULT_PROPERTY_DETAILS = {
  address: '',
  municipal_registration: '',
  registry_number: '',
  coordinates: '',
  owner: '',
  occupant: '',
  property_type: '',
  declared_area: '',
  characteristics: '',
};

export const DEFAULT_PROJECT_FORM = {
  title: '',
  internal_code: '',
  cliente_id: '',
  property: DEFAULT_PROPERTY_DETAILS,
  responsible_technical: '',
  team: '',
  situation: 'ativo',
  start_date: '',
  expected_end_date: '',
  contract_value: '',
  contract_number: '',
  administrative_process: '',
  service_order: '',
  art_number: '',
  art_status: 'pendente',
  object_description: '',
};

export const DEFAULT_DOCUMENT_DRAFT = {
  type: 'vistoria',
  title: 'Relatório de vistoria',
  cliente_id: '',
  project_id: '',
  orcamento_id: '',
  status: ENGINEERING_DOCUMENT_STATUS.draft,
  version: '1.0',
  purpose: '',
  object: '',
  request_received: '',
  history: '',
  methodology: '',
  inspection_date: '',
  inspection_time: '',
  participants: '',
  conditions: '',
  findings: '',
  reported_information: '',
  hypothesis: '',
  confirmed_conclusion: '',
  analysis: '',
  recommendations: '',
  limitations: '',
  priority: 'media',
  next_steps: '',
  art: {
    number: '',
    status: 'pendente',
    date: '',
    consultation_url: '',
    not_applicable: false,
    justification: '',
  },
  photos: [],
  enabled_blocks: [],
  ai_assisted: false,
};

export const FIELD_GUIDES = {
  object: 'Descreva de forma objetiva o serviço solicitado e o elemento que será analisado.',
  findings: 'Registre somente o que foi efetivamente observado durante a vistoria.',
  reported_information: 'Identifique quem forneceu a informação e evite apresentá-la como constatação própria.',
  analysis: 'Relacione elementos observados, documentos consultados, medições e limitações da inspeção.',
  recommendations: 'Informe a ação sugerida, a prioridade e a necessidade de avaliação complementar.',
  limitations: 'Informe áreas sem acesso, elementos encobertos, ausência de ensaios ou documentos não disponibilizados.',
};

export const createLocalId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getDocumentTemplate = (type) => (
  DOCUMENT_TEMPLATES.find(template => template.type === type)
  || DOCUMENT_TEMPLATES[0]
);

export const getDocumentStatusLabel = (status) => (
  ENGINEERING_DOCUMENT_STATUS_OPTIONS.find(option => option.value === status)?.label || 'Rascunho'
);

export const getDocumentStatusClass = (status) => {
  const classes = {
    [ENGINEERING_DOCUMENT_STATUS.draft]: 'bg-slate-100 text-slate-700',
    [ENGINEERING_DOCUMENT_STATUS.review]: 'bg-amber-100 text-amber-800',
    [ENGINEERING_DOCUMENT_STATUS.returned]: 'bg-red-100 text-red-700',
    [ENGINEERING_DOCUMENT_STATUS.revised]: 'bg-cyan-100 text-cyan-800',
    [ENGINEERING_DOCUMENT_STATUS.approved]: 'bg-emerald-100 text-emerald-800',
    [ENGINEERING_DOCUMENT_STATUS.signed]: 'bg-blue-100 text-blue-800',
    [ENGINEERING_DOCUMENT_STATUS.delivered]: 'bg-indigo-100 text-indigo-800',
    [ENGINEERING_DOCUMENT_STATUS.archived]: 'bg-slate-200 text-slate-700',
    [ENGINEERING_DOCUMENT_STATUS.cancelled]: 'bg-red-100 text-red-700',
  };

  return classes[status] || classes[ENGINEERING_DOCUMENT_STATUS.draft];
};

export const createDraftFromTemplate = (type) => {
  const template = getDocumentTemplate(type);
  return {
    ...DEFAULT_DOCUMENT_DRAFT,
    type: template.type,
    title: template.title,
    purpose: template.defaultPurpose,
    enabled_blocks: template.blocks,
    local_draft_id: createLocalId(),
  };
};

export const getNextDocumentVersion = (version = '1.0') => {
  const [majorRaw, minorRaw] = String(version || '1.0').split('.');
  const major = Number(majorRaw) || 1;
  const minor = Number(minorRaw) || 0;
  return `${major}.${minor + 1}`;
};

export const normalizeDocumentDraft = (draft = {}) => ({
  ...DEFAULT_DOCUMENT_DRAFT,
  ...draft,
  art: {
    ...DEFAULT_DOCUMENT_DRAFT.art,
    ...(draft.art || {}),
  },
  photos: Array.isArray(draft.photos) ? draft.photos.slice(0, 80) : [],
  enabled_blocks: Array.isArray(draft.enabled_blocks)
    ? draft.enabled_blocks
    : getDocumentTemplate(draft.type).blocks,
});

export const compressImageFile = (file, { maxSize = 1600, quality = 0.82 } = {}) => {
  if (!file || !file.type?.startsWith('image/')) {
    return Promise.reject(new Error('Selecione uma imagem válida.'));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) {
          reject(new Error('Não foi possível comprimir a imagem.'));
          return;
        }

        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        }));
      }, 'image/jpeg', quality);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível carregar a imagem.'));
    };

    image.src = objectUrl;
  });
};

export const createVerificationCode = (parts = []) => {
  const source = parts.filter(Boolean).join('|') || String(Date.now());
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
};
