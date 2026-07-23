import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { useOrcamentos } from '../useOrcamentos';
import { useClientes } from '../useClientes';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  applyCatalogOverrides,
  buildCatalogOverridePayload,
  catalogoMateriais,
  catalogoPacotes,
  catalogoServicos,
} from '../catalogoOrcamento';
import {
  calculateMaterialPlan,
  getMaterialCalculatorTemplate,
  materialCalculatorTemplates,
} from '../materialCalculator';
import {
  calculateOrcamentoTotals,
  estimateInternetPrice,
  getDraftValue,
  getOrcamentoDraftItems,
  nextDraftState,
  nextNumericId,
} from '../orcamentoUtils';
import {
  ORCAMENTO_STATUS,
  getOrcamentoStatusClass,
  getOrcamentoStatusLabel,
  normalizeOrcamentoStatus
} from '../orcamentoStatus';
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_COMPANY_TERMS,
  DEFAULT_PAYMENT_DETAILS,
  PAYMENT_METHOD_OPTIONS,
  buildPaymentDescription,
  buildPublicOrcamentoUrl,
  createShareToken,
  getDefaultValidUntil,
  getPaymentMethodLabel,
  hexToRgb,
  normalizePaymentDetails,
  sanitizeHexColor,
} from '../publicOrcamento';
import { PROFESSIONAL_TEMPLATES } from '../professionalTemplates';
import {
  DEFAULT_ENGINEERING_DETAILS,
  ENGINEERING_PRICE_SOURCE_OPTIONS,
  ENGINEERING_UF_OPTIONS,
  ENGINEERING_UNIT_OPTIONS,
  ENGINEERING_WORK_TYPE_OPTIONS,
  getEngineeringWorkTypeLabel,
  getItemBdiRate,
  getLineBaseTotal,
  getLineTotalWithBdi,
  getMeasurementsTotal,
  getScheduleTotalPercent,
  isEngineeringDateBaseStale,
  normalizeEngineeringDetails,
  parseSinapiCsv,
} from '../engineeringUtils';

const toPublicNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const toPublicText = (value, fallback, limit = 140) => {
  const text = String(value || fallback).trim();
  return text.slice(0, limit);
};

const toPublicOptionalText = (value, limit = 180) => String(value || '').trim().slice(0, limit);

const buildPublicMaterial = (item) => ({
  nome: toPublicText(item?.nome, 'Material'),
  qtd: toPublicNumber(item?.qtd),
  precoVenda: toPublicNumber(item?.precoVenda),
  unidade: toPublicOptionalText(item?.unidade || 'un', 20),
  fonte: toPublicOptionalText(item?.fonte, 80),
  codigo: toPublicOptionalText(item?.codigo, 60),
  memoria_calculo: toPublicOptionalText(item?.memoria_calculo, 220),
  bdi_rate: toPublicNumber(item?.bdi_rate),
});

const buildPublicServico = (item) => ({
  descricao: toPublicText(item?.descricao, 'Servico'),
  horas: toPublicNumber(item?.horas),
  valorHora: toPublicNumber(item?.valorHora),
  unidade: toPublicOptionalText(item?.unidade || 'h', 20),
  fonte: toPublicOptionalText(item?.fonte, 80),
  codigo: toPublicOptionalText(item?.codigo, 60),
  memoria_calculo: toPublicOptionalText(item?.memoria_calculo, 220),
  bdi_rate: toPublicNumber(item?.bdi_rate),
});

export default function NovoOrcamento() {
  const { clienteId: clienteIdParam, orcamentoId: orcamentoIdParam } = useParams();
  const navigate = useNavigate();
  const { orcamentos, addOrcamento, updateOrcamento, getOrcamentoRevisions } = useOrcamentos();
  const { clientes } = useClientes();
  
  const orcamentoId = orcamentoIdParam ? orcamentoIdParam : null;
  const clienteId = clienteIdParam ? clienteIdParam : null;
  
  // Carregar dados do Firebase se editando
  const orcamentoExistente = useMemo(() => {
    if (orcamentoId) {
      return orcamentos.find(o => String(o.id) === String(orcamentoId));
    }
    return null;
  }, [orcamentoId, orcamentos]);

  const cliente = useMemo(() => {
    let targetClienteId = clienteId;
    if (orcamentoExistente && orcamentoExistente.cliente_id) {
      targetClienteId = orcamentoExistente.cliente_id;
    }
    if (targetClienteId) {
      return clientes.find(c => String(c.id) === String(targetClienteId)) || null;
    }
    return null;
  }, [clienteId, orcamentoExistente, clientes]);

  const resolvedClienteId = cliente?.id || clienteId;

  const draftKey = orcamentoId || `novo:${clienteId || 'sem-cliente'}`;
  const baseDraftItems = useMemo(() => getOrcamentoDraftItems(orcamentoExistente), [orcamentoExistente]);
  const basePaymentDetails = useMemo(() => normalizePaymentDetails(orcamentoExistente?.payment || DEFAULT_PAYMENT_DETAILS), [orcamentoExistente]);
  const baseEngineeringDetails = useMemo(
    () => normalizeEngineeringDetails(orcamentoExistente?.engineering || DEFAULT_ENGINEERING_DETAILS),
    [orcamentoExistente]
  );
  const [materiaisDraft, setMateriaisDraft] = useState({ key: draftKey, value: null });
  const [maoDeObraDraft, setMaoDeObraDraft] = useState({ key: draftKey, value: null });
  const [paymentDraft, setPaymentDraft] = useState({ key: draftKey, value: null });
  const [engineeringDraft, setEngineeringDraft] = useState({ key: draftKey, value: null });
  const materiais = getDraftValue(materiaisDraft, draftKey, baseDraftItems.materiais);
  const maoDeObra = getDraftValue(maoDeObraDraft, draftKey, baseDraftItems.maoDeObra);
  const paymentDetails = getDraftValue(paymentDraft, draftKey, basePaymentDetails);
  const engineeringDetails = getDraftValue(engineeringDraft, draftKey, baseEngineeringDetails);

  const setMateriais = useCallback((updater) => {
    setMateriaisDraft((previousDraft) => nextDraftState(previousDraft, draftKey, baseDraftItems.materiais, updater));
  }, [draftKey, baseDraftItems.materiais]);

  const setMaoDeObra = useCallback((updater) => {
    setMaoDeObraDraft((previousDraft) => nextDraftState(previousDraft, draftKey, baseDraftItems.maoDeObra, updater));
  }, [draftKey, baseDraftItems.maoDeObra]);

  const setPaymentDetails = useCallback((updater) => {
    setPaymentDraft((previousDraft) => nextDraftState(previousDraft, draftKey, basePaymentDetails, updater));
  }, [draftKey, basePaymentDetails]);

  const setEngineeringDetails = useCallback((updater) => {
    setEngineeringDraft((previousDraft) => nextDraftState(previousDraft, draftKey, baseEngineeringDetails, (currentValue) => {
      const nextValue = typeof updater === 'function' ? updater(currentValue) : updater;
      return normalizeEngineeringDetails(nextValue);
    }));
  }, [draftKey, baseEngineeringDetails]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showModalMaterial, setShowModalMaterial] = useState(false);
  const [showModalServico, setShowModalServico] = useState(false);
  const [novoMaterial, setNovoMaterial] = useState({
    nome: '',
    qtd: 1,
    precoVenda: '',
    custo: '',
    unidade: 'un',
    fonte: 'Composicao propria',
    codigo: '',
    memoria_calculo: '',
    bdi_rate: '',
  });
  const [novoServico, setNovoServico] = useState({
    descricao: '',
    horas: 1,
    valorHora: '',
    unidade: 'h',
    fonte: 'Composicao propria',
    codigo: '',
    memoria_calculo: '',
    bdi_rate: '',
  });
  const [expandedMaterial, setExpandedMaterial] = useState(null);
  const [expandedServico, setExpandedServico] = useState(null);
  const [catalogMode, setCatalogMode] = useState('materiais');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('todos');
  const [catalogOverrides, setCatalogOverrides] = useState({ materiais: {}, servicos: {}, pacotes: {} });
  const [catalogDrafts, setCatalogDrafts] = useState({});
  const [sinapiItems, setSinapiItems] = useState([]);
  const [sinapiSearch, setSinapiSearch] = useState('');
  const [savingCatalogItem, setSavingCatalogItem] = useState(null);
  const [isCatalogCollapsed, setIsCatalogCollapsed] = useState(false);
  const [catalogFeedback, setCatalogFeedback] = useState('');
  const catalogFeedbackTimeoutRef = useRef(null);
  const [showMaterialCalculator, setShowMaterialCalculator] = useState(false);
  const [calculatorForm, setCalculatorForm] = useState({
    tipo: materialCalculatorTemplates[0].id,
    ...materialCalculatorTemplates[0].defaultValues,
  });

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const [userId, setUserId] = useState(null);
  const [showModalCompanyDetails, setShowModalCompanyDetails] = useState(false);
  const [showProposalPreview, setShowProposalPreview] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAccentColor, setCompanyAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [companyTerms, setCompanyTerms] = useState(DEFAULT_COMPANY_TERMS);
  const [publishingPublicLink, setPublishingPublicLink] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);

  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [revisionHistory, setRevisionHistory] = useState([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  const showCatalogFeedback = useCallback((message) => {
    setCatalogFeedback(message);

    if (catalogFeedbackTimeoutRef.current) {
      window.clearTimeout(catalogFeedbackTimeoutRef.current);
    }

    catalogFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCatalogFeedback('');
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (catalogFeedbackTimeoutRef.current) {
        window.clearTimeout(catalogFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const showAiSoon = () => {
    toast('Assistente de IA em breve. A geração automática ficará disponível após a configuração.');
  };

  const resetNovoMaterial = () => setNovoMaterial({
    nome: '',
    qtd: 1,
    precoVenda: '',
    custo: '',
    unidade: 'un',
    fonte: engineeringDetails.enabled ? engineeringDetails.reference_source : 'Composicao propria',
    codigo: '',
    memoria_calculo: '',
    bdi_rate: '',
  });

  const resetNovoServico = () => setNovoServico({
    descricao: '',
    horas: 1,
    valorHora: '',
    unidade: 'h',
    fonte: engineeringDetails.enabled ? engineeringDetails.reference_source : 'Composicao propria',
    codigo: '',
    memoria_calculo: '',
    bdi_rate: '',
  });

  const getDefaultItemSource = (source = '') => {
    if (source) return source;
    return engineeringDetails.enabled ? engineeringDetails.reference_source : 'Catalogo OrcaJa';
  };

  const getTechnicalItemFields = (source = {}, unitFallback = 'un') => ({
    unidade: String(source.unidade || unitFallback).trim(),
    fonte: getDefaultItemSource(source.fonte),
    codigo: String(source.codigo || '').trim(),
    memoria_calculo: String(source.memoria_calculo || '').trim(),
    bdi_rate: source.bdi_rate === '' || source.bdi_rate === undefined || source.bdi_rate === null
      ? ''
      : Number(source.bdi_rate),
  });

  const updateEngineeringDetail = (field, value) => {
    setEngineeringDetails(prev => ({
      ...prev,
      [field]: ['enabled'].includes(field) ? Boolean(value) : value,
    }));
  };

  const updateScheduleStage = (id, field, value) => {
    setEngineeringDetails(prev => ({
      ...prev,
      schedule: prev.schedule.map(stage => (
        stage.id === id
          ? { ...stage, [field]: field === 'percentual' ? Number(value) : value }
          : stage
      )),
    }));
  };

  const addScheduleStage = () => {
    setEngineeringDetails(prev => ({
      ...prev,
      schedule: [
        ...prev.schedule,
        {
          id: nextNumericId(prev.schedule),
          etapa: `Etapa ${prev.schedule.length + 1}`,
          periodo: '',
          percentual: 0,
        },
      ],
    }));
  };

  const removeScheduleStage = (id) => {
    setEngineeringDetails(prev => ({
      ...prev,
      schedule: prev.schedule.filter(stage => stage.id !== id),
    }));
  };

  const updateMeasurement = (id, field, value) => {
    setEngineeringDetails(prev => ({
      ...prev,
      measurements: prev.measurements.map(measurement => (
        measurement.id === id
          ? { ...measurement, [field]: ['percentual', 'valor'].includes(field) ? Number(value) : value }
          : measurement
      )),
    }));
  };

  const addMeasurement = () => {
    setEngineeringDetails(prev => ({
      ...prev,
      measurements: [
        ...prev.measurements,
        {
          id: nextNumericId(prev.measurements),
          data: new Date().toISOString().slice(0, 10),
          etapa: `Medicao ${prev.measurements.length + 1}`,
          percentual: 0,
          valor: 0,
          observacao: '',
        },
      ],
    }));
  };

  const removeMeasurement = (id) => {
    setEngineeringDetails(prev => ({
      ...prev,
      measurements: prev.measurements.filter(measurement => measurement.id !== id),
    }));
  };

  const removeMaterial = id => setMateriais(materiais.filter(item => item.id !== id));
  const removeServico = id => setMaoDeObra(maoDeObra.filter(item => item.id !== id));

  const handleAddMaterial = () => {
    if (!novoMaterial.nome || !novoMaterial.precoVenda) return;

    setMateriais(prev => [
      ...prev,
      {
        id: nextNumericId(prev),
        nome: novoMaterial.nome,
        qtd: Number(novoMaterial.qtd),
        precoVenda: Number(novoMaterial.precoVenda),
        custo: Number(novoMaterial.custo) || 0,
        precoInternet: estimateInternetPrice(novoMaterial.nome, novoMaterial.precoVenda),
        ...getTechnicalItemFields(novoMaterial, novoMaterial.unidade || 'un'),
      }
    ]);

    resetNovoMaterial();
    setShowModalMaterial(false);
    showCatalogFeedback(`${novoMaterial.nome} adicionado aos materiais.`);
  };

  const handleAddServico = () => {
    if (!novoServico.descricao || !novoServico.valorHora) return;

    setMaoDeObra(prev => [
      ...prev,
      {
        id: nextNumericId(prev),
        descricao: novoServico.descricao,
        horas: Number(novoServico.horas),
        valorHora: Number(novoServico.valorHora),
        ...getTechnicalItemFields(novoServico, novoServico.unidade || 'h'),
      }
    ]);

    resetNovoServico();
    setShowModalServico(false);
    showCatalogFeedback(`${novoServico.descricao} adicionado aos serviços.`);
  };

  const addCatalogMaterial = (material) => {
    setMateriais(prev => [
      ...prev,
      {
        id: nextNumericId(prev),
        nome: material.nome,
        qtd: Number(material.qtd || 1),
        precoVenda: Number(material.precoVenda || 0),
        custo: Number(material.custo || 0),
        precoInternet: estimateInternetPrice(material.nome, material.precoVenda),
        ...getTechnicalItemFields(material, material.unidade || 'un'),
      }
    ]);
    showCatalogFeedback(`${material.nome} adicionado aos materiais.`);
  };

  const addCatalogServico = (servico) => {
    setMaoDeObra(prev => [
      ...prev,
      {
        id: nextNumericId(prev),
        descricao: servico.descricao,
        horas: Number(servico.horas || 1),
        valorHora: Number(servico.valorHora || 0),
        ...getTechnicalItemFields(servico, servico.unidade || 'h'),
      }
    ]);
    showCatalogFeedback(`${servico.descricao} adicionado aos serviços.`);
  };

  const addCatalogPackage = (pacote) => {
    setMateriais(prev => {
      const firstId = nextNumericId(prev);
      return [
        ...prev,
        ...pacote.materiais.map((material, index) => {
          const customMaterial = catalogoPersonalizado.materiais.find(item => item.nome === material.nome) || material;

          return {
            id: firstId + index,
            nome: customMaterial.nome,
            qtd: Number(customMaterial.qtd || material.qtd || 1),
            precoVenda: Number(customMaterial.precoVenda || 0),
            custo: Number(customMaterial.custo || 0),
            precoInternet: estimateInternetPrice(customMaterial.nome, customMaterial.precoVenda),
            ...getTechnicalItemFields(customMaterial, customMaterial.unidade || 'un'),
          };
        })
      ];
    });

    setMaoDeObra(prev => {
      const firstId = nextNumericId(prev);
      return [
        ...prev,
        ...pacote.servicos.map((servico, index) => {
          const customServico = catalogoPersonalizado.servicos.find(item => item.descricao === servico.descricao) || servico;

          return {
            id: firstId + index,
            descricao: customServico.descricao,
            horas: Number(customServico.horas || servico.horas || 1),
            valorHora: Number(customServico.valorHora || 0),
            ...getTechnicalItemFields(customServico, customServico.unidade || 'h'),
          };
        })
      ];
    });

    showCatalogFeedback(`${pacote.nome} adicionado ao orçamento.`);
  };

  const applyProfessionalTemplate = (template) => {
    setMateriais(prev => {
      const firstId = nextNumericId(prev);
      return [
        ...prev,
        ...template.materiais.map((material, index) => ({
          ...material,
          id: firstId + index,
          precoInternet: estimateInternetPrice(material.nome, material.precoVenda),
          ...getTechnicalItemFields(material, material.unidade || 'un'),
        })),
      ];
    });

    setMaoDeObra(prev => {
      const firstId = nextNumericId(prev);
      return [
        ...prev,
        ...template.servicos.map((servico, index) => ({
          ...servico,
          id: firstId + index,
          ...getTechnicalItemFields(servico, servico.unidade || 'h'),
        })),
      ];
    });

    if (template.terms) {
      setCompanyTerms(template.terms);
    }

    showCatalogFeedback(`Template de ${template.label.toLowerCase()} aplicado.`);
  };

  const updateCatalogDraft = (itemId, field, value) => {
    setCatalogDrafts(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value
      }
    }));
  };

  const getCatalogDraftValue = (item, field) => {
    return catalogDrafts[item.id]?.[field] ?? item[field] ?? '';
  };

  const saveCatalogPrice = async (type, item, changes) => {
    const user = auth.currentUser;
    if (!user) {
      toast.error('Faça login para editar o catálogo.');
      return;
    }

    const payload = buildCatalogOverridePayload(type, item, changes);
    setSavingCatalogItem(item.id);

    try {
      await setDoc(doc(db, 'catalog_overrides', user.uid), {
        user_id: user.uid,
        [type]: {
          [item.id]: payload
        },
        updated_at: new Date().toISOString()
      }, { merge: true });

      setCatalogOverrides(prev => ({
        ...prev,
        [type]: {
          ...(prev[type] || {}),
          [item.id]: payload
        }
      }));

      setCatalogDrafts(prev => {
        const nextDrafts = { ...prev };
        delete nextDrafts[item.id];
        return nextDrafts;
      });
      toast.success('Preço do catálogo salvo.');
    } catch (error) {
      console.error('Erro ao salvar preço do catálogo:', error);
      toast.error(`Erro ao salvar preço do catálogo: ${error.message || 'Tente novamente'}`);
    } finally {
      setSavingCatalogItem(null);
    }
  };

  const updateCalculatorForm = (field, value) => {
    setCalculatorForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const changeCalculatorType = (tipo) => {
    const nextTemplate = getMaterialCalculatorTemplate(tipo);
    setCalculatorForm({
      tipo,
      ...nextTemplate.defaultValues,
    });
  };

  const updateMaterial = (id, field, value) => {
    const numericFields = ['qtd', 'precoVenda', 'custo', 'bdi_rate'];
    setMateriais(materiais.map(item => (
      item.id === id
        ? { ...item, [field]: numericFields.includes(field) && value !== '' ? Number(value) : value }
        : item
    )));
  };

  const updateServico = (id, field, value) => {
    const numericFields = ['horas', 'valorHora', 'bdi_rate'];
    setMaoDeObra(maoDeObra.map(item => (
      item.id === id
        ? { ...item, [field]: numericFields.includes(field) && value !== '' ? Number(value) : value }
        : item
    )));
  };

  const updatePaymentDetails = (field, value) => {
    setPaymentDetails(prev => normalizePaymentDetails({
      ...prev,
      [field]: ['down_payment', 'installments'].includes(field) ? Number(value) : value,
    }));
  };

  const importSinapiCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Exporte a planilha do SINAPI como CSV para importar nesta versão.');
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const importedItems = parseSinapiCsv(text);
      setSinapiItems(importedItems);
      setSinapiSearch('');
      setEngineeringDetails(prev => ({
        ...prev,
        enabled: true,
        reference_source: 'SINAPI',
      }));
      toast.success(`${importedItems.length} itens técnicos importados.`);
    } catch (error) {
      console.error('Erro ao importar SINAPI:', error);
      toast.error('Não foi possível importar o CSV.');
    } finally {
      event.target.value = '';
    }
  };

  const addSinapiItem = (item, targetType) => {
    const technicalFields = getTechnicalItemFields({
      unidade: item.unidade,
      fonte: item.fonte || 'SINAPI',
      codigo: item.codigo,
      memoria_calculo: '',
      bdi_rate: '',
    }, item.unidade || 'un');

    if (targetType === 'servico') {
      setMaoDeObra(prev => [
        ...prev,
        {
          id: nextNumericId(prev),
          descricao: item.descricao,
          horas: 1,
          valorHora: Number(item.preco || 0),
          ...technicalFields,
        },
      ]);
      showCatalogFeedback(`${item.descricao} adicionado aos serviços.`);
      return;
    }

    setMateriais(prev => [
      ...prev,
      {
        id: nextNumericId(prev),
        nome: item.descricao,
        qtd: 1,
        precoVenda: Number(item.preco || 0),
        custo: Number(item.preco || 0),
        precoInternet: estimateInternetPrice(item.descricao, item.preco),
        ...technicalFields,
      },
    ]);
    showCatalogFeedback(`${item.descricao} adicionado aos materiais.`);
  };

  const alteraQtdMaterial = (id, delta) => {
    setMateriais(materiais.map(m => m.id === id ? { ...m, qtd: Math.max(1, m.qtd + delta) } : m));
  };

  const alteraHoras = (id, delta) => {
    setMaoDeObra(maoDeObra.map(m => m.id === id ? { ...m, horas: Math.max(1, m.horas + delta) } : m));
  };

  useEffect(() => {
    const loadCompanyDetails = async () => {
      const user = auth.currentUser;
      if (user) {
        setUserId(user.uid);
        try {
          const docRef = doc(db, 'company_profiles', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setCompanyName(data.company_name || '');
            setCompanyAddress(data.company_address || '');
            setCompanyPhone(data.company_phone || '');
            setCompanyEmail(data.company_email || '');
            setCompanyAccentColor(sanitizeHexColor(data.company_accent_color, DEFAULT_ACCENT_COLOR));
            setCompanyTerms(data.company_terms || DEFAULT_COMPANY_TERMS);
          }

          const catalogRef = doc(db, 'catalog_overrides', user.uid);
          const catalogSnap = await getDoc(catalogRef);
          if (catalogSnap.exists()) {
            const data = catalogSnap.data();
            setCatalogOverrides({
              materiais: data.materiais || {},
              servicos: data.servicos || {},
              pacotes: data.pacotes || {},
            });
          }
        } catch (error) {
          console.error('Erro ao carregar dados da empresa:', error);
        }
      }
    };
    loadCompanyDetails();
  }, []);

  const saveCompanyDetails = async () => {
    if (!userId) {
      toast.error('Usuário não autenticado.');
      return;
    }
    
    try {
      await setDoc(doc(db, 'company_profiles', userId), {
        user_id: userId,
        company_name: companyName,
        company_address: companyAddress,
        company_phone: companyPhone,
        company_email: companyEmail,
        company_accent_color: sanitizeHexColor(companyAccentColor, DEFAULT_ACCENT_COLOR),
        company_terms: companyTerms || DEFAULT_COMPANY_TERMS,
      }, { merge: true });
      setShowModalCompanyDetails(false);
      toast.success('Dados da empresa salvos com sucesso.');
    } catch (error) {
      toast.error(`Erro ao salvar dados da empresa: ${error.message || 'Tente novamente'}`);
    }
  };

  const gerarPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      // Criar PDF em tamanho A4 (210mm x 297mm)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 15;

      // --- Configurações de Estilo ---
      const primaryColor = [30, 41, 59]; // slate-800
      const secondaryColor = [71, 85, 105]; // slate-600
      const accentColor = hexToRgb(companyAccentColor); // brand color

      const marginX = 15;
      const tableRowHeight = 8; // Height of each table row

      // Função para verificar quebra de página
      const checkPageBreak = (minHeight = tableRowHeight) => {
        if (yPosition + minHeight > pageHeight - 25) {
          pdf.addPage();
          yPosition = 20;
          pdf.setFont('Helvetica', 'italic');
          pdf.setFontSize(9);
          pdf.setTextColor(100, 116, 139);
          pdf.text(`Orçamento - ${cliente?.nome || 'Cliente'} (Continuação)`, marginX, yPosition);
          yPosition += 8;
        }
      };

      // --- Barra Superior (Detalhe Visual) ---
      pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.rect(0, 0, pageWidth, 8, 'F');
      yPosition = 20;

      // --- Cabeçalho da Empresa (Esquerda) ---
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text(companyName || 'Sua Empresa', marginX, yPosition);
      yPosition += 6;
      
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      if (companyAddress) {
        pdf.text(companyAddress, marginX, yPosition);
        yPosition += 5;
      }
      const contactInfo = [companyPhone && `Tel: ${companyPhone}`, companyEmail && `Email: ${companyEmail}`].filter(Boolean).join(' | ');
      if (contactInfo) {
        pdf.text(contactInfo, marginX, yPosition);
        yPosition += 5;
      }

      // --- Caixa de Orçamento (Direita) ---
      const orcBoxW = 60;
      const orcBoxH = 22;
      const orcBoxX = pageWidth - marginX - orcBoxW;
      const orcBoxY = 15;
      
      pdf.setFillColor(239, 246, 255); // blue-50
      pdf.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.roundedRect(orcBoxX, orcBoxY, orcBoxW, orcBoxH, 2, 2, 'FD');
      
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.text('ORÇAMENTO', orcBoxX + orcBoxW / 2, orcBoxY + 7, { align: 'center' });
      
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      const numDisplay = orcamentoExistente?.numero ? String(orcamentoExistente.numero).padStart(4, '0') : (orcamentoId ? '---' : 'Novo');
      pdf.text(`Nº: ${numDisplay}`, orcBoxX + 5, orcBoxY + 14);
      pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, orcBoxX + 5, orcBoxY + 19);

      yPosition = Math.max(yPosition, orcBoxY + orcBoxH) + 10;

      // --- Dados do Cliente ---
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text('DADOS DO CLIENTE', marginX, yPosition);
      yPosition += 3;

      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(203, 213, 225);
      pdf.roundedRect(marginX, yPosition, pageWidth - 2 * marginX, 24, 2, 2, 'FD');
      
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);
      
      pdf.text(`Nome: ${cliente?.nome || 'N/A'}`, marginX + 5, yPosition + 7);
      pdf.text(`Telefone: ${cliente?.telefone || 'N/A'}`, marginX + 110, yPosition + 7);
      pdf.text(`Email: ${cliente?.email || 'N/A'}`, marginX + 5, yPosition + 14);
      pdf.text(`Endereço: ${cliente?.endereco || 'N/A'}`, marginX + 5, yPosition + 21);

      yPosition += 32;

      if (normalizedEngineeringDetails.enabled) {
        checkPageBreak(36);
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.text('DADOS TÉCNICOS', marginX, yPosition);
        yPosition += 3;

        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(203, 213, 225);
        pdf.roundedRect(marginX, yPosition, pageWidth - 2 * marginX, 30, 2, 2, 'FD');

        pdf.setFont('Helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(30, 41, 59);
        pdf.text(`Tipo: ${getEngineeringWorkTypeLabel(normalizedEngineeringDetails.work_type)}`, marginX + 5, yPosition + 7);
        pdf.text(`Fonte: ${normalizedEngineeringDetails.reference_source || 'N/A'} ${normalizedEngineeringDetails.reference_uf || ''}`, marginX + 110, yPosition + 7);
        pdf.text(`Objeto: ${(normalizedEngineeringDetails.object || 'N/A').slice(0, 95)}`, marginX + 5, yPosition + 14);
        pdf.text(`Local: ${(normalizedEngineeringDetails.location || 'N/A').slice(0, 95)}`, marginX + 5, yPosition + 21);
        pdf.text(`Responsável: ${(normalizedEngineeringDetails.responsible_name || 'N/A').slice(0, 46)}`, marginX + 5, yPosition + 28);
        pdf.text(`Registro: ${normalizedEngineeringDetails.professional_registry || 'N/A'}`, marginX + 110, yPosition + 28);
        yPosition += 38;
      }

      // --- Helper para Títulos de Tabela ---
      const drawTableHeader = (title) => {
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.text(title, marginX, yPosition);
        yPosition += 4;

        pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.rect(marginX, yPosition, pageWidth - 2 * marginX, tableRowHeight, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text('Descrição', marginX + 3, yPosition + 5.5);
        pdf.text('Qtd/Horas', 130, yPosition + 5.5, { align: 'right' });
        pdf.text('Valor Unit.', 160, yPosition + 5.5, { align: 'right' });
        pdf.text('Total', pageWidth - marginX - 3, yPosition + 5.5, { align: 'right' });
        
        yPosition += tableRowHeight;
      };

      // --- Tabela de Materiais ---
      if (materiais.length > 0) {
        drawTableHeader('MATERIAIS');
        
        pdf.setFont('Helvetica', 'normal');
        materiais.forEach((item, index) => {
          checkPageBreak();
          if (index % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(marginX, yPosition, pageWidth - 2 * marginX, tableRowHeight, 'F');
          }
          
          let itemName = item.nome;
          if (itemName.length > 55) itemName = itemName.substring(0, 55) + '...';

          pdf.setTextColor(30, 41, 59);
          pdf.text(itemName, marginX + 3, yPosition + 5.5);
          pdf.text(`${item.qtd} ${item.unidade || 'un'}`, 130, yPosition + 5.5, { align: 'right' });
          pdf.text(`R$ ${Number(item.precoVenda || 0).toFixed(2).replace('.', ',')}`, 160, yPosition + 5.5, { align: 'right' });
          pdf.text(`R$ ${getLineBaseTotal(item, 'qtd', 'precoVenda').toFixed(2).replace('.', ',')}`, pageWidth - marginX - 3, yPosition + 5.5, { align: 'right' });
          
          yPosition += tableRowHeight;
        });

        pdf.setDrawColor(203, 213, 225);
        pdf.line(marginX, yPosition, pageWidth - marginX, yPosition);
        yPosition += 5;
        pdf.setFont('Helvetica', 'bold');
        pdf.text('Subtotal Materiais:', 160, yPosition, { align: 'right' });
        pdf.text(`R$ ${totalMateriais.toFixed(2).replace('.', ',')}`, pageWidth - marginX - 3, yPosition, { align: 'right' });
        yPosition += 12;
      }

      // --- Tabela de Serviços ---
      if (maoDeObra.length > 0) {
        checkPageBreak(tableRowHeight * 3);
        drawTableHeader('SERVIÇOS');
        
        pdf.setFont('Helvetica', 'normal');
        maoDeObra.forEach((item, index) => {
          checkPageBreak();
          if (index % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(marginX, yPosition, pageWidth - 2 * marginX, tableRowHeight, 'F');
          }
          
          let itemDesc = item.descricao;
          if (itemDesc.length > 55) itemDesc = itemDesc.substring(0, 55) + '...';

          pdf.setTextColor(30, 41, 59);
          pdf.text(itemDesc, marginX + 3, yPosition + 5.5);
          pdf.text(`${item.horas} ${item.unidade || 'h'}`, 130, yPosition + 5.5, { align: 'right' });
          pdf.text(`R$ ${Number(item.valorHora || 0).toFixed(2).replace('.', ',')}`, 160, yPosition + 5.5, { align: 'right' });
          pdf.text(`R$ ${getLineBaseTotal(item, 'horas', 'valorHora').toFixed(2).replace('.', ',')}`, pageWidth - marginX - 3, yPosition + 5.5, { align: 'right' });
          
          yPosition += tableRowHeight;
        });

        pdf.setDrawColor(203, 213, 225);
        pdf.line(marginX, yPosition, pageWidth - marginX, yPosition);
      yPosition += 5;
      pdf.setFont('Helvetica', 'bold');
        pdf.text('Subtotal Serviços:', 160, yPosition, { align: 'right' });
        pdf.text(`R$ ${totalMaoDeObra.toFixed(2).replace('.', ',')}`, pageWidth - marginX - 3, yPosition, { align: 'right' });
        yPosition += 12;
      }

      // --- Total Geral ---
      checkPageBreak(40);
      yPosition += 5;
      const summaryBoxW = 80;
      const summaryBoxH = normalizedEngineeringDetails.enabled && totalBdi > 0 ? 42 : 30;
      const summaryBoxX = pageWidth - marginX - summaryBoxW;
      
      pdf.setFillColor(239, 246, 255); // light accent
      pdf.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.roundedRect(summaryBoxX, yPosition, summaryBoxW, summaryBoxH, 2, 2, 'FD');
  
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      
      pdf.text('Materiais:', summaryBoxX + 5, yPosition + 8);
      pdf.text(`R$ ${totalMateriais.toFixed(2).replace('.', ',')}`, summaryBoxX + summaryBoxW - 5, yPosition + 8, { align: 'right' });
      
      pdf.text('Serviços:', summaryBoxX + 5, yPosition + 14);
      pdf.text(`R$ ${totalMaoDeObra.toFixed(2).replace('.', ',')}`, summaryBoxX + summaryBoxW - 5, yPosition + 14, { align: 'right' });

      if (normalizedEngineeringDetails.enabled && totalBdi > 0) {
        pdf.text('BDI:', summaryBoxX + 5, yPosition + 20);
        pdf.text(`R$ ${totalBdi.toFixed(2).replace('.', ',')}`, summaryBoxX + summaryBoxW - 5, yPosition + 20, { align: 'right' });
      }
      
      pdf.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.line(summaryBoxX + 5, yPosition + (normalizedEngineeringDetails.enabled && totalBdi > 0 ? 26 : 18), summaryBoxX + summaryBoxW - 5, yPosition + (normalizedEngineeringDetails.enabled && totalBdi > 0 ? 26 : 18));
  
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('TOTAL:', summaryBoxX + 5, yPosition + (normalizedEngineeringDetails.enabled && totalBdi > 0 ? 35 : 25));
      pdf.text(`R$ ${totalGeral.toFixed(2).replace('.', ',')}`, summaryBoxX + summaryBoxW - 5, yPosition + (normalizedEngineeringDetails.enabled && totalBdi > 0 ? 35 : 25), { align: 'right' });
      yPosition += summaryBoxH + 8;

      checkPageBreak(22);
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text('PAGAMENTO', marginX, yPosition);
      yPosition += 5;
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.text(paymentDescription, marginX, yPosition);
      yPosition += 5;
      if (normalizedPaymentDetails.notes) {
        pdf.text(normalizedPaymentDetails.notes.slice(0, 100), marginX, yPosition);
        yPosition += 5;
      }

      if (normalizedEngineeringDetails.enabled) {
        const memoryRows = [
          ...materiais.map(item => ({
            label: item.nome,
            memory: item.memoria_calculo,
            source: item.fonte,
            code: item.codigo,
          })),
          ...maoDeObra.map(item => ({
            label: item.descricao,
            memory: item.memoria_calculo,
            source: item.fonte,
            code: item.codigo,
          })),
        ].filter(item => item.memory || item.source || item.code).slice(0, 10);

        if (memoryRows.length) {
          checkPageBreak(20 + memoryRows.length * 8);
          yPosition += 5;
          pdf.setFont('Helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          pdf.text('MEMÓRIA DE CÁLCULO E FONTES', marginX, yPosition);
          yPosition += 6;

          pdf.setFont('Helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          memoryRows.forEach((item) => {
            checkPageBreak(8);
            const sourceLine = [item.code && `Cód. ${item.code}`, item.source].filter(Boolean).join(' | ');
            pdf.text(`${item.label.slice(0, 70)}${sourceLine ? ` - ${sourceLine}` : ''}`.slice(0, 120), marginX, yPosition);
            yPosition += 4;
            if (item.memory) {
              pdf.text(`Memória: ${item.memory.slice(0, 120)}`, marginX, yPosition);
              yPosition += 4;
            }
          });
        }

        if (normalizedEngineeringDetails.schedule.length) {
          checkPageBreak(20 + normalizedEngineeringDetails.schedule.length * 6);
          yPosition += 5;
          pdf.setFont('Helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          pdf.text('CRONOGRAMA FÍSICO-FINANCEIRO', marginX, yPosition);
          yPosition += 6;

          pdf.setFont('Helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          normalizedEngineeringDetails.schedule.forEach((stage) => {
            checkPageBreak(6);
            const stageValue = totalGeral * (Number(stage.percentual || 0) / 100);
            pdf.text(`${stage.etapa} | ${stage.periodo || 'Sem período'} | ${stage.percentual}% | R$ ${stageValue.toFixed(2).replace('.', ',')}`, marginX, yPosition);
            yPosition += 5;
          });
        }

        if (normalizedEngineeringDetails.technical_notes) {
          checkPageBreak(16);
          yPosition += 5;
          pdf.setFont('Helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          pdf.text('OBSERVAÇÕES TÉCNICAS', marginX, yPosition);
          yPosition += 5;
          pdf.setFont('Helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          pdf.text(normalizedEngineeringDetails.technical_notes.slice(0, 160), marginX, yPosition);
          yPosition += 6;
        }
      }

      // --- Condições / Observações ---
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.text('Observações:', marginX, yPosition + 5);
      String(companyTerms || DEFAULT_COMPANY_TERMS)
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 4)
        .forEach((line, index) => {
          pdf.text(`${index + 1}. ${line.replace(/^\d+\.\s*/, '')}`, marginX, yPosition + 10 + (index * 5));
        });

      // --- Rodapé ---
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        
        // Faixa de cor no rodapé
        pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
        
        pdf.setFont('Helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139); // slate-500
        pdf.text('Obrigado pela preferência!', pageWidth / 2, pageHeight - 12, { align: 'center' });
        
        pdf.setTextColor(255, 255, 255);
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 3, { align: 'right' });
        pdf.text(companyName || 'Orçamento', marginX, pageHeight - 3);
      }

      // Salvar PDF
      const filename = `orcamento-${cliente?.nome || 'geral'}-${new Date().getTime()}.pdf`;
      pdf.save(filename);
      toast.success('PDF gerado com sucesso.');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error(`Erro ao gerar PDF: ${error.message || 'Tente novamente'}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const normalizedEngineeringDetails = normalizeEngineeringDetails(engineeringDetails);
  const {
    totalMateriais,
    totalMaoDeObra,
    subtotalGeral,
    totalBdi,
    totalGeral,
  } = calculateOrcamentoTotals(materiais, maoDeObra, normalizedEngineeringDetails);
  const formatCurrencyText = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
  const normalizedPaymentDetails = normalizePaymentDetails(paymentDetails);
  const paymentDescription = buildPaymentDescription(normalizedPaymentDetails, totalGeral, formatCurrencyText);
  const schedulePercent = getScheduleTotalPercent(normalizedEngineeringDetails.schedule);
  const measuredTotal = getMeasurementsTotal(normalizedEngineeringDetails.measurements);
  const dateBaseIsStale = isEngineeringDateBaseStale(normalizedEngineeringDetails.date_base);

  const normalizeWhatsAppPhone = (phone = '') => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55')) return digits;
    return `55${digits}`;
  };

  const buildShareMessage = ({ publicUrl, targetOrcamento } = {}) => {
    const sourceOrcamento = targetOrcamento || orcamentoExistente;
    const numero = sourceOrcamento?.numero ? String(sourceOrcamento.numero).padStart(4, '0') : 'novo';
    const proposalUrl = publicUrl || sourceOrcamento?.public_url;
    const linhas = [
      `Olá, ${cliente?.nome || 'tudo bem'}!`,
      `${companyName || 'Nossa equipe'} preparou o orçamento #${numero}.`,
      normalizedEngineeringDetails.enabled && normalizedEngineeringDetails.object
        ? `Objeto: ${normalizedEngineeringDetails.object}.`
        : '',
      `Materiais: R$ ${totalMateriais.toFixed(2).replace('.', ',')}`,
      `Serviços: R$ ${totalMaoDeObra.toFixed(2).replace('.', ',')}`,
      normalizedEngineeringDetails.enabled && totalBdi > 0
        ? `BDI: R$ ${totalBdi.toFixed(2).replace('.', ',')}`
        : '',
      `Total: R$ ${totalGeral.toFixed(2).replace('.', ',')}`,
      normalizedEngineeringDetails.enabled
        ? `Fonte de preços: ${normalizedEngineeringDetails.reference_source}${normalizedEngineeringDetails.reference_uf ? `/${normalizedEngineeringDetails.reference_uf}` : ''}.`
        : '',
      `Pagamento: ${paymentDescription}`,
      proposalUrl ? `Aprove ou acompanhe por aqui: ${proposalUrl}` : '',
      'O orçamento é válido por 15 dias. Posso tirar alguma dúvida?'
    ].filter(Boolean);

    return linhas.join('\n');
  };

  const buildOrcamentoPayload = (status = normalizeOrcamentoStatus(orcamentoExistente?.status)) => ({
    cliente_id: resolvedClienteId,
    itens: materiais,
    servicos: maoDeObra,
    total: totalGeral,
    subtotal: subtotalGeral,
    bdi_total: totalBdi,
    engineering: normalizedEngineeringDetails,
    payment: normalizedPaymentDetails,
    status,
  });

  const saveCurrentOrcamento = async ({ silent = false } = {}) => {
    if (!resolvedClienteId) {
      throw new Error('Selecione um cliente para salvar o orçamento.');
    }

    if (orcamentoId) {
      await updateOrcamento(orcamentoId, buildOrcamentoPayload());
      if (!silent) toast.success('Orçamento atualizado com sucesso.');
      return {
        ...(orcamentoExistente || {}),
        id: orcamentoId,
        ...buildOrcamentoPayload(),
      };
    }

    const novoOrc = await addOrcamento(buildOrcamentoPayload(ORCAMENTO_STATUS.draft));
    if (!silent) toast.success('Orçamento salvo com sucesso.');
    navigate(`/orcamento/editar/${novoOrc.id}`, { replace: true });
    return novoOrc;
  };

  const publishApprovalLink = async ({ copy = true, targetOrcamento } = {}) => {
    const sourceOrcamento = targetOrcamento || orcamentoExistente;
    const targetOrcamentoId = sourceOrcamento?.id || orcamentoId;

    if (!targetOrcamentoId) {
      toast.error('Salve o orçamento antes de gerar o link de aprovação.');
      return null;
    }

    if (!cliente) {
      toast.error('Selecione um cliente antes de gerar o link.');
      return null;
    }

    const ownerId = userId || auth.currentUser?.uid;
    if (!ownerId) {
      toast.error('Usuário não autenticado.');
      return null;
    }

    setPublishingPublicLink(true);
    try {
      const now = new Date().toISOString();
      const token = sourceOrcamento?.share_token || createShareToken();
      const publicUrl = buildPublicOrcamentoUrl(token);
      const currentOrcamentoStatus = normalizeOrcamentoStatus(sourceOrcamento?.status);
      const statusToPublish = currentOrcamentoStatus === ORCAMENTO_STATUS.draft
        ? ORCAMENTO_STATUS.sent
        : currentOrcamentoStatus;
      const publicItens = materiais.map(buildPublicMaterial);
      const publicServicos = maoDeObra.map(buildPublicServico);

      await setDoc(doc(db, 'public_orcamentos', token), {
        user_id: ownerId,
        orcamento_id: String(targetOrcamentoId),
        share_token: token,
        public_url: publicUrl,
        numero: sourceOrcamento?.numero || null,
        status: statusToPublish,
        cliente: {
          nome: cliente.nome || 'Cliente',
        },
        company: {
          name: companyName || 'Sua empresa',
          address: companyAddress || '',
          phone: companyPhone || '',
          email: companyEmail || '',
          accent_color: sanitizeHexColor(companyAccentColor, DEFAULT_ACCENT_COLOR),
          terms: companyTerms || DEFAULT_COMPANY_TERMS,
        },
        itens: publicItens,
        servicos: publicServicos,
        payment: normalizedPaymentDetails,
        payment_description: paymentDescription,
        technical: {
          enabled: normalizedEngineeringDetails.enabled,
          work_type: normalizedEngineeringDetails.work_type,
          work_type_label: getEngineeringWorkTypeLabel(normalizedEngineeringDetails.work_type),
          object: normalizedEngineeringDetails.object,
          location: normalizedEngineeringDetails.location,
          requester: normalizedEngineeringDetails.requester,
          responsible_name: normalizedEngineeringDetails.responsible_name,
          professional_registry: normalizedEngineeringDetails.professional_registry,
          date_base: normalizedEngineeringDetails.date_base,
          reference_source: normalizedEngineeringDetails.reference_source,
          reference_uf: normalizedEngineeringDetails.reference_uf,
          reference_month: normalizedEngineeringDetails.reference_month,
          global_bdi: normalizedEngineeringDetails.global_bdi,
          technical_notes: normalizedEngineeringDetails.technical_notes,
          schedule: normalizedEngineeringDetails.schedule,
        },
        total: totalGeral,
        subtotal: subtotalGeral,
        bdi_total: totalBdi,
        total_materiais: totalMateriais,
        total_servicos: totalMaoDeObra,
        valid_until: getDefaultValidUntil(),
        published_at: sourceOrcamento?.published_at || now,
        updated_at: now,
      }, { merge: true });

      await updateOrcamento(targetOrcamentoId, {
        share_token: token,
        public_url: publicUrl,
        public_updated_at: now,
        status: statusToPublish,
      });

      if (copy) {
        try {
          await navigator.clipboard.writeText(publicUrl);
          toast.success('Link de aprovação copiado.');
        } catch {
          toast.success('Link de aprovação gerado.');
        }
      }

      return {
        publicUrl,
        token,
        status: statusToPublish,
        orcamento: {
          ...sourceOrcamento,
          id: targetOrcamentoId,
          share_token: token,
          public_url: publicUrl,
          status: statusToPublish,
        },
      };
    } catch (error) {
      console.error('Erro ao publicar link de aprovação:', error);
      toast.error(`Erro ao gerar link: ${error.message || 'Tente novamente'}`);
      return null;
    } finally {
      setPublishingPublicLink(false);
    }
  };

  const enviarWhatsApp = () => {
    const phone = normalizeWhatsAppPhone(cliente?.telefone || '');
    if (phone.length < 12) {
      toast.error('Cadastre o telefone do cliente para enviar o orçamento pelo WhatsApp.');
      return;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildShareMessage())}`, '_blank', 'noopener,noreferrer');
    toast.success('WhatsApp aberto para envio.');

    if (orcamentoId && normalizeOrcamentoStatus(orcamentoExistente?.status) === ORCAMENTO_STATUS.draft) {
      updateOrcamento(orcamentoId, { status: ORCAMENTO_STATUS.sent }).catch((error) => {
        console.error('Erro ao marcar orçamento como enviado:', error);
      });
    }
  };

  const enviarProposta = async () => {
    const phone = normalizeWhatsAppPhone(cliente?.telefone || '');
    if (phone.length < 12) {
      toast.error('Cadastre o telefone do cliente para enviar a proposta pelo WhatsApp.');
      return;
    }

    setSendingProposal(true);
    try {
      const savedOrcamento = await saveCurrentOrcamento({ silent: true });
      const published = await publishApprovalLink({
        copy: false,
        targetOrcamento: savedOrcamento,
      });

      if (!published?.publicUrl) return;

      const message = buildShareMessage({
        publicUrl: published.publicUrl,
        targetOrcamento: published.orcamento,
      });
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      setShowProposalPreview(false);
      toast.success('Proposta pronta para envio pelo WhatsApp.');
    } catch (error) {
      console.error('Erro ao enviar proposta:', error);
      toast.error(`Erro ao enviar proposta: ${error.message || 'Tente novamente'}`);
    } finally {
      setSendingProposal(false);
    }
  };

  const gerarLinkProposta = async () => {
    try {
      const savedOrcamento = await saveCurrentOrcamento({ silent: true });
      await publishApprovalLink({
        copy: true,
        targetOrcamento: savedOrcamento,
      });
    } catch (error) {
      console.error('Erro ao gerar link da proposta:', error);
      toast.error(`Erro ao gerar link: ${error.message || 'Tente novamente'}`);
    }
  };

  const openRevisionHistory = async () => {
    if (!orcamentoId) return;

    setShowRevisionHistory(true);
    setLoadingRevisions(true);
    try {
      const revisions = await getOrcamentoRevisions(orcamentoId);
      setRevisionHistory(revisions);
    } catch (error) {
      toast.error(`Erro ao carregar histórico: ${error.message || 'Tente novamente'}`);
    } finally {
      setLoadingRevisions(false);
    }
  };

  const salvarOrcamento = async () => {
    try {
      await saveCurrentOrcamento();
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      toast.error(`Erro ao salvar orçamento: ${error.message || 'Tente novamente'}`);
    }
  };

  const filteredMateriais = materiais.filter(item => 
    item.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const catalogModes = [
    { value: 'materiais', label: 'Materiais' },
    { value: 'servicos', label: 'Serviços' },
    { value: 'pacotes', label: 'Pacotes' },
  ];

  const catalogoPersonalizado = applyCatalogOverrides(
    {
      materiais: catalogoMateriais,
      servicos: catalogoServicos,
      pacotes: catalogoPacotes,
    },
    catalogOverrides,
  );

  const catalogSource = catalogMode === 'materiais'
    ? catalogoPersonalizado.materiais
    : catalogMode === 'servicos'
      ? catalogoPersonalizado.servicos
      : catalogoPersonalizado.pacotes;

  const calculatorTemplate = getMaterialCalculatorTemplate(calculatorForm.tipo);
  const calculatorPlan = calculateMaterialPlan(calculatorForm.tipo, calculatorForm, {
    materiais: catalogoPersonalizado.materiais,
    servicos: catalogoPersonalizado.servicos,
  });
  const calculatorTotals = calculateOrcamentoTotals(calculatorPlan.materiais, calculatorPlan.servicos);

  const addCalculatorPlan = () => {
    setMateriais(prev => {
      const firstId = nextNumericId(prev);
      return [
        ...prev,
        ...calculatorPlan.materiais.map((material, index) => ({
          ...material,
          id: firstId + index,
          precoInternet: estimateInternetPrice(material.nome, material.precoVenda)
        }))
      ];
    });

    setMaoDeObra(prev => {
      const firstId = nextNumericId(prev);
      return [
        ...prev,
        ...calculatorPlan.servicos.map((servico, index) => ({
          ...servico,
          id: firstId + index,
        }))
      ];
    });

    setShowMaterialCalculator(false);
    showCatalogFeedback('Cálculo adicionado ao orçamento.');
  };

  const catalogCategories = ['todos', ...new Set(catalogSource.map(item => item.categoria))];

  const filteredCatalog = catalogSource.filter((item) => {
    const text = [
      item.nome,
      item.descricao,
      item.categoria,
      item.unidade
    ].filter(Boolean).join(' ').toLowerCase();

    return (catalogCategory === 'todos' || item.categoria === catalogCategory)
      && text.includes(catalogSearch.toLowerCase());
  });

  const filteredSinapiItems = sinapiItems.filter((item) => {
    const haystack = [item.codigo, item.descricao, item.unidade].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(sinapiSearch.toLowerCase());
  }).slice(0, 8);

  const currentStatus = normalizeOrcamentoStatus(orcamentoExistente?.status);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gray-50">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">
              {orcamentoId ? `✏️ Editar Orçamento #${orcamentoExistente?.numero ? String(orcamentoExistente.numero).padStart(4, '0') : '...'}` : (resolvedClienteId && cliente ? `📋 ${cliente.nome}` : '📋 Novo Orçamento')}
              </h1>
              <p className="truncate text-xs text-slate-300">
                {resolvedClienteId && cliente ? `Cliente: ${cliente.telefone}` : 'Orçamento rápido'}
              </p>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:justify-end">
            <button
              onClick={gerarPDF}
              disabled={isGeneratingPDF}
              className="min-w-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400 sm:px-4"
            >
              {isGeneratingPDF ? '⏳ Gerando...' : '📄 Gerar PDF'}
            </button>
            <button
              type="button"
              onClick={() => setShowProposalPreview(true)}
              className="min-w-0 rounded-lg border border-slate-400 bg-slate-800 px-3 py-2 text-sm font-semibold transition hover:bg-slate-700 sm:px-4"
            >
              Prévia
            </button>
            {cliente && (
              <button
                type="button"
                onClick={enviarProposta}
                disabled={sendingProposal || publishingPublicLink}
                className="min-w-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400 sm:px-4"
              >
                {sendingProposal ? 'Enviando...' : 'Enviar proposta'}
              </button>
            )}
            {cliente && (
              <button
                onClick={enviarWhatsApp}
                className="min-w-0 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 sm:px-4"
              >
                WhatsApp
              </button>
            )}
            {cliente && orcamentoId && (
              <button
                type="button"
                onClick={gerarLinkProposta}
                disabled={publishingPublicLink}
                className="min-w-0 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-gray-400 sm:px-4"
              >
                {publishingPublicLink ? 'Publicando...' : 'Link'}
              </button>
            )}
            <button
              onClick={() => setShowModalCompanyDetails(true)}
              className="min-w-0 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold transition hover:bg-slate-800 sm:px-4"
            >
              ⚙️ Empresa
            </button>
            {resolvedClienteId && (
              <button
                onClick={salvarOrcamento}
                disabled={isGeneratingPDF}
                className="min-w-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 sm:px-4"
              >
                💾 Salvar
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="min-w-0 rounded-lg border border-slate-400 bg-slate-800 px-3 py-2 text-sm transition hover:bg-slate-700 sm:px-4"
            >
              ← Voltar
            </button>
            {orcamentoId && (
              <button
                type="button"
                onClick={openRevisionHistory}
                className="min-w-0 rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-semibold transition hover:bg-slate-700 sm:px-4"
              >
                Histórico
              </button>
            )}
            <span className={`flex min-w-0 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold sm:rounded-full sm:py-1 ${getOrcamentoStatusClass(currentStatus)}`}>
              {getOrcamentoStatusLabel(currentStatus).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Cliente</p>
            <p className="mt-1 truncate text-lg font-black text-slate-900">{cliente?.nome || 'Não selecionado'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Materiais</p>
            <p className="mt-1 text-lg font-black text-slate-900">R$ {totalMateriais.toFixed(2).replace('.', ',')}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Serviços</p>
            <p className="mt-1 text-lg font-black text-slate-900">R$ {totalMaoDeObra.toFixed(2).replace('.', ',')}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-blue-700">Total para aprovação</p>
            <p className="mt-1 text-lg font-black text-blue-950">R$ {totalGeral.toFixed(2).replace('.', ',')}</p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Modo Engenharia</h2>
              <p className="text-sm text-slate-500">
                Dados técnicos, BDI, fonte de preços, cronograma e medições.
              </p>
            </div>
            <label className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={normalizedEngineeringDetails.enabled}
                onChange={event => updateEngineeringDetail('enabled', event.target.checked)}
                className="h-4 w-4"
              />
              Ativar
            </label>
          </div>

          {normalizedEngineeringDetails.enabled ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 lg:grid-cols-4">
                <label className="block text-sm font-bold text-slate-700">
                  Tipo
                  <select
                    value={normalizedEngineeringDetails.work_type}
                    onChange={event => updateEngineeringDetail('work_type', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ENGINEERING_WORK_TYPE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-bold text-slate-700 lg:col-span-3">
                  Objeto
                  <input
                    value={normalizedEngineeringDetails.object}
                    onChange={event => updateEngineeringDetail('object', event.target.value)}
                    placeholder="Ex.: Reforma da unidade básica de saúde"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700 lg:col-span-2">
                  Local da obra
                  <input
                    value={normalizedEngineeringDetails.location}
                    onChange={event => updateEngineeringDetail('location', event.target.value)}
                    placeholder="Endereço, bairro ou equipamento público"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700 lg:col-span-2">
                  Secretaria ou solicitante
                  <input
                    value={normalizedEngineeringDetails.requester}
                    onChange={event => updateEngineeringDetail('requester', event.target.value)}
                    placeholder="Secretaria, setor ou fiscal solicitante"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700 lg:col-span-2">
                  Responsável técnico
                  <input
                    value={normalizedEngineeringDetails.responsible_name}
                    onChange={event => updateEngineeringDetail('responsible_name', event.target.value)}
                    placeholder="Nome do engenheiro ou arquiteto"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  CREA/CAU
                  <input
                    value={normalizedEngineeringDetails.professional_registry}
                    onChange={event => updateEngineeringDetail('professional_registry', event.target.value)}
                    placeholder="Registro profissional"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  BDI global (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={normalizedEngineeringDetails.global_bdi}
                    onChange={event => updateEngineeringDetail('global_bdi', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Fonte principal
                  <select
                    value={normalizedEngineeringDetails.reference_source}
                    onChange={event => updateEngineeringDetail('reference_source', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ENGINEERING_PRICE_SOURCE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  UF
                  <select
                    value={normalizedEngineeringDetails.reference_uf}
                    onChange={event => updateEngineeringDetail('reference_uf', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ENGINEERING_UF_OPTIONS.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Data-base
                  <input
                    type="date"
                    value={normalizedEngineeringDetails.date_base}
                    onChange={event => updateEngineeringDetail('date_base', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Mês referência
                  <input
                    type="month"
                    value={normalizedEngineeringDetails.reference_month}
                    onChange={event => updateEngineeringDetail('reference_month', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>

              {(dateBaseIsStale || totalBdi > 0) && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Subtotal técnico</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatCurrencyText(subtotalGeral)}</p>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-bold uppercase text-blue-700">BDI aplicado</p>
                    <p className="mt-1 text-lg font-black text-blue-950">{formatCurrencyText(totalBdi)}</p>
                  </div>
                  <div className={`rounded-lg border p-3 ${dateBaseIsStale ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <p className={`text-xs font-bold uppercase ${dateBaseIsStale ? 'text-amber-700' : 'text-emerald-700'}`}>Data-base</p>
                    <p className={`mt-1 text-sm font-black ${dateBaseIsStale ? 'text-amber-900' : 'text-emerald-900'}`}>
                      {dateBaseIsStale ? 'Revisar referência' : 'Dentro do período'}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-black text-slate-900">Base técnica</h3>
                      <p className="text-sm text-slate-500">{sinapiItems.length ? `${sinapiItems.length} itens importados` : 'Importe CSV com código, descrição, unidade e preço.'}</p>
                    </div>
                    <label className="w-fit cursor-pointer rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
                      Importar CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={importSinapiCsv}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <input
                    type="search"
                    value={sinapiSearch}
                    onChange={event => setSinapiSearch(event.target.value)}
                    placeholder="Buscar por código ou descrição..."
                    disabled={!sinapiItems.length}
                    className="mt-4 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />

                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                    {sinapiItems.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                        A base importada fica apenas nesta edição; os itens escolhidos são salvos no orçamento.
                      </p>
                    ) : filteredSinapiItems.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                        Nenhum item técnico encontrado.
                      </p>
                    ) : filteredSinapiItems.map(item => (
                      <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase text-slate-500">{item.codigo || 'Sem código'} · {item.unidade}</p>
                            <p className="mt-1 break-words text-sm font-black text-slate-900">{item.descricao}</p>
                            <p className="mt-1 text-sm font-bold text-slate-700">{formatCurrencyText(item.preco)}</p>
                          </div>
                          <div className="grid shrink-0 grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => addSinapiItem(item, 'material')}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                            >
                              Material
                            </button>
                            <button
                              type="button"
                              onClick={() => addSinapiItem(item, 'servico')}
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                            >
                              Serviço
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-black text-slate-900">Cronograma físico-financeiro</h3>
                        <p className="text-sm text-slate-500">Distribuição atual: {schedulePercent.toFixed(2).replace('.', ',')}%</p>
                      </div>
                      <button
                        type="button"
                        onClick={addScheduleStage}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
                      >
                        Adicionar
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {normalizedEngineeringDetails.schedule.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                          Nenhuma etapa adicionada.
                        </p>
                      ) : normalizedEngineeringDetails.schedule.map(stage => (
                        <div key={stage.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1.2fr_1fr_100px_32px]">
                          <input
                            value={stage.etapa}
                            onChange={event => updateScheduleStage(stage.id, 'etapa', event.target.value)}
                            className="rounded border border-slate-200 p-2 text-sm"
                            placeholder="Etapa"
                          />
                          <input
                            value={stage.periodo}
                            onChange={event => updateScheduleStage(stage.id, 'periodo', event.target.value)}
                            className="rounded border border-slate-200 p-2 text-sm"
                            placeholder="Período"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={stage.percentual}
                            onChange={event => updateScheduleStage(stage.id, 'percentual', event.target.value)}
                            className="rounded border border-slate-200 p-2 text-sm"
                            placeholder="%"
                          />
                          <button
                            type="button"
                            onClick={() => removeScheduleStage(stage.id)}
                            className="rounded border border-red-200 bg-red-50 text-sm font-bold text-red-700 hover:bg-red-100"
                          >
                            ×
                          </button>
                          <p className="text-xs font-bold text-slate-500 md:col-span-4">
                            Valor previsto: {formatCurrencyText(totalGeral * (Number(stage.percentual || 0) / 100))}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-black text-slate-900">Medições</h3>
                        <p className="text-sm text-slate-500">Medido: {formatCurrencyText(measuredTotal)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={addMeasurement}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                      >
                        Registrar
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {normalizedEngineeringDetails.measurements.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                          Nenhuma medição registrada.
                        </p>
                      ) : normalizedEngineeringDetails.measurements.map(measurement => (
                        <div key={measurement.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[130px_1fr_90px_120px_32px]">
                          <input
                            type="date"
                            value={measurement.data}
                            onChange={event => updateMeasurement(measurement.id, 'data', event.target.value)}
                            className="rounded border border-slate-200 p-2 text-sm"
                          />
                          <input
                            value={measurement.etapa}
                            onChange={event => updateMeasurement(measurement.id, 'etapa', event.target.value)}
                            className="rounded border border-slate-200 p-2 text-sm"
                            placeholder="Etapa medida"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={measurement.percentual}
                            onChange={event => updateMeasurement(measurement.id, 'percentual', event.target.value)}
                            className="rounded border border-slate-200 p-2 text-sm"
                            placeholder="%"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={measurement.valor}
                            onChange={event => updateMeasurement(measurement.id, 'valor', event.target.value)}
                            className="rounded border border-slate-200 p-2 text-sm"
                            placeholder="Valor"
                          />
                          <button
                            type="button"
                            onClick={() => removeMeasurement(measurement.id)}
                            className="rounded border border-red-200 bg-red-50 text-sm font-bold text-red-700 hover:bg-red-100"
                          >
                            ×
                          </button>
                          <input
                            value={measurement.observacao}
                            onChange={event => updateMeasurement(measurement.id, 'observacao', event.target.value)}
                            className="rounded border border-slate-200 p-2 text-sm md:col-span-5"
                            placeholder="Observação da medição"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <label className="block text-sm font-bold text-slate-700">
                Observações técnicas
                <textarea
                  rows={3}
                  value={normalizedEngineeringDetails.technical_notes}
                  onChange={event => updateEngineeringDetail('technical_notes', event.target.value)}
                  placeholder="Critérios adotados, premissas, exclusões e observações da composição."
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              Orçamentos rápidos continuam iguais. Ative quando precisar de dados técnicos para engenharia.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Templates por profissão</h2>
              <p className="text-sm text-slate-500">Comece com uma base pronta e ajuste materiais, serviços e valores depois.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {PROFESSIONAL_TEMPLATES.map(template => (
              <div key={template.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-blue-700">{template.label}</p>
                <h3 className="mt-2 font-black text-slate-900">{template.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{template.description}</p>
                <button
                  type="button"
                  onClick={() => applyProfessionalTemplate(template)}
                  className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Aplicar template
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pagamento e envio</h2>
              <p className="text-sm text-slate-500">Essas condições aparecem no PDF, no link público e na mensagem enviada ao cliente.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-bold text-slate-700">
                  Forma de pagamento
                  <select
                    value={normalizedPaymentDetails.method}
                    onChange={e => updatePaymentDetails('method', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PAYMENT_METHOD_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Parcelas
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={normalizedPaymentDetails.installments}
                    onChange={e => updatePaymentDetails('installments', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Entrada
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={normalizedPaymentDetails.down_payment}
                    onChange={e => updatePaymentDetails('down_payment', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700 sm:col-span-2">
                  Observação de pagamento
                  <input
                    value={normalizedPaymentDetails.notes}
                    onChange={e => updatePaymentDetails('notes', e.target.value)}
                    placeholder="Ex.: PIX na aprovação e restante na entrega"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase text-blue-700">Resumo para o cliente</p>
              <p className="mt-2 text-lg font-black text-blue-950">{getPaymentMethodLabel(normalizedPaymentDetails.method)}</p>
              <p className="mt-2 text-sm font-semibold text-blue-900">{paymentDescription}</p>
              {normalizedPaymentDetails.notes && (
                <p className="mt-2 text-sm text-blue-800">{normalizedPaymentDetails.notes}</p>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setShowProposalPreview(true)}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                >
                  Ver prévia
                </button>
                <button
                  type="button"
                  onClick={enviarProposta}
                  disabled={!cliente || sendingProposal || publishingPublicLink}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {sendingProposal ? 'Preparando...' : 'Enviar proposta'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Catálogo rápido</h2>
              <p className="text-sm text-slate-500">Selecione materiais, serviços ou pacotes prontos e ajuste depois no orçamento.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isCatalogCollapsed && catalogModes.map(mode => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => {
                      setCatalogMode(mode.value);
                      setCatalogCategory('todos');
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                      catalogMode === mode.value
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setIsCatalogCollapsed(prev => !prev)}
                aria-expanded={!isCatalogCollapsed}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {isCatalogCollapsed ? 'Expandir' : 'Minimizar'}
              </button>
            </div>
          </div>

          {catalogFeedback && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"
            >
              {catalogFeedback}
            </div>
          )}

          {!isCatalogCollapsed && (
            <>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_auto_auto_auto]">
                <input
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  type="search"
                  placeholder="Buscar no catálogo..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={catalogCategory}
                  onChange={e => setCatalogCategory(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {catalogCategories.map(category => (
                    <option key={category} value={category}>
                      {category === 'todos' ? 'Todas as categorias' : category}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowModalMaterial(true)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                >
                  Material manual
                </button>
                <button
                  type="button"
                  onClick={() => setShowModalServico(true)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Serviço manual
                </button>
                <button
                  type="button"
                  onClick={() => setShowMaterialCalculator(true)}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  Calcular materiais
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredCatalog.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                    Nada encontrado no catálogo. Use os botões manuais para criar um item personalizado.
                  </div>
                ) : filteredCatalog.slice(0, 9).map(item => (
                  <div key={item.id} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold uppercase text-slate-500">
                          {item.categoria}
                        </span>
                        <h3 className="mt-2 break-words font-bold text-slate-900">{item.nome || item.descricao}</h3>
                        {item.descricao && item.nome && (
                          <p className="mt-1 break-words text-sm text-slate-500">{item.descricao}</p>
                        )}
                      </div>
                    </div>

                    {catalogMode === 'materiais' && (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
                          <label className="text-xs font-semibold text-slate-600">
                            Qtd.
                            <input
                              type="number"
                              min="1"
                              value={getCatalogDraftValue(item, 'qtd')}
                              onChange={e => updateCatalogDraft(item.id, 'qtd', e.target.value)}
                              className="mt-1 w-full rounded border border-slate-200 bg-white p-2 text-sm text-slate-900"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Venda
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getCatalogDraftValue(item, 'precoVenda')}
                              onChange={e => updateCatalogDraft(item.id, 'precoVenda', e.target.value)}
                              className="mt-1 w-full rounded border border-slate-200 bg-white p-2 text-sm text-slate-900"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Custo
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getCatalogDraftValue(item, 'custo')}
                              onChange={e => updateCatalogDraft(item.id, 'custo', e.target.value)}
                              className="mt-1 w-full rounded border border-slate-200 bg-white p-2 text-sm text-slate-900"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => saveCatalogPrice('materiais', item, {
                              qtd: getCatalogDraftValue(item, 'qtd'),
                              precoVenda: getCatalogDraftValue(item, 'precoVenda'),
                              custo: getCatalogDraftValue(item, 'custo'),
                            })}
                            disabled={savingCatalogItem === item.id}
                            className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                          >
                            {savingCatalogItem === item.id ? 'Salvando...' : 'Salvar preço'}
                          </button>
                          <button
                            type="button"
                            onClick={() => addCatalogMaterial(item)}
                            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}

                    {catalogMode === 'servicos' && (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs font-semibold text-slate-600">
                            Horas
                            <input
                              type="number"
                              min="1"
                              value={getCatalogDraftValue(item, 'horas')}
                              onChange={e => updateCatalogDraft(item.id, 'horas', e.target.value)}
                              className="mt-1 w-full rounded border border-slate-200 bg-white p-2 text-sm text-slate-900"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Valor/hora
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getCatalogDraftValue(item, 'valorHora')}
                              onChange={e => updateCatalogDraft(item.id, 'valorHora', e.target.value)}
                              className="mt-1 w-full rounded border border-slate-200 bg-white p-2 text-sm text-slate-900"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => saveCatalogPrice('servicos', item, {
                              horas: getCatalogDraftValue(item, 'horas'),
                              valorHora: getCatalogDraftValue(item, 'valorHora'),
                            })}
                            disabled={savingCatalogItem === item.id}
                            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            {savingCatalogItem === item.id ? 'Salvando...' : 'Salvar valor'}
                          </button>
                          <button
                            type="button"
                            onClick={() => addCatalogServico(item)}
                            className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}

                    {catalogMode === 'pacotes' && (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-lg bg-white p-2">
                            <p className="text-xs text-slate-500">Materiais</p>
                            <p className="font-black text-slate-900">{item.materiais.length}</p>
                          </div>
                          <div className="rounded-lg bg-white p-2">
                            <p className="text-xs text-slate-500">Serviços</p>
                            <p className="font-black text-slate-900">{item.servicos.length}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addCatalogPackage(item)}
                          className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                          Adicionar pacote
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* FILTRO E BUSCA ONLINE */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              type="search" 
              placeholder="🔍 Filtrar materiais..." 
              className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
            <button 
              onClick={() => setShowModalMaterial(true)}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-white text-sm font-semibold transition whitespace-nowrap"
            >
              + Material
            </button>
          </div>
        </div>

        {/* MATERIAIS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">🛒 Materiais ({filteredMateriais.length})</h2>
            <span className="text-sm text-slate-600">Total: <strong>R$ {totalMateriais.toFixed(2).replace('.', ',')}</strong></span>
          </div>

          {filteredMateriais.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>Nenhum material encontrado. {materiais.length === 0 ? 'Comece adicionando um!' : ''}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMateriais.map(item => (
                <div 
                  key={item.id}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition"
                >
                  {/* VISTA COMPACTA */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedMaterial(expandedMaterial === item.id ? null : item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setExpandedMaterial(expandedMaterial === item.id ? null : item.id);
                      }
                    }}
                    className="flex w-full min-w-0 items-center justify-between px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1 text-left">
                      <p className="break-words text-sm font-semibold text-slate-900">{item.nome}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.qtd} {item.unidade || 'un'} × R$ {Number(item.precoVenda || 0).toFixed(2).replace('.', ',')} = <strong>{formatCurrencyText(getLineTotalWithBdi(item, 'qtd', 'precoVenda', normalizedEngineeringDetails))}</strong>
                        {normalizedEngineeringDetails.enabled && getItemBdiRate(item, normalizedEngineeringDetails) > 0 ? ` com BDI ${getItemBdiRate(item, normalizedEngineeringDetails).toFixed(2).replace('.', ',')}%` : ''}
                      </p>
                      {normalizedEngineeringDetails.enabled && (item.fonte || item.codigo) && (
                        <p className="mt-1 text-xs font-semibold text-blue-700">
                          {[item.fonte, item.codigo && `Código ${item.codigo}`].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); alteraQtdMaterial(item.id, -1); }}
                          className="w-6 h-6 rounded text-red-600 hover:bg-red-50 text-xs font-bold"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-xs font-semibold">{item.qtd}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); alteraQtdMaterial(item.id, 1); }}
                          className="w-6 h-6 rounded text-green-600 hover:bg-green-50 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <span className="ml-2 shrink-0 text-xl text-slate-400">{expandedMaterial === item.id ? '▼' : '▶'}</span>
                  </div>

                  {/* VISTA EXPANDIDA */}
                  {expandedMaterial === item.id && (
                    <div className="border-t border-slate-200 px-4 py-3 bg-slate-50 space-y-3">
                      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <label className="text-xs text-slate-500">Nome</label>
                          <input 
                            value={item.nome}
                            onChange={e => updateMaterial(item.id, 'nome', e.target.value)}
                            className="w-full p-2 rounded border border-slate-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Quantidade</label>
                          <input 
                            type="number"
                            min="1"
                            value={item.qtd}
                            onChange={e => updateMaterial(item.id, 'qtd', e.target.value)}
                            className="w-full p-2 rounded border border-slate-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Preço Venda</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={item.precoVenda}
                            onChange={e => updateMaterial(item.id, 'precoVenda', e.target.value)}
                            className="w-full p-2 rounded border border-slate-200 text-sm"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Custo</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={item.custo}
                            onChange={e => updateMaterial(item.id, 'custo', e.target.value)}
                            className="w-full p-2 rounded border border-slate-200 text-sm"
                            min="0"
                          />
                        </div>
                        {normalizedEngineeringDetails.enabled && (
                          <>
                            <div>
                              <label className="text-xs text-slate-500">Unidade</label>
                              <select
                                value={item.unidade || 'un'}
                                onChange={e => updateMaterial(item.id, 'unidade', e.target.value)}
                                className="w-full rounded border border-slate-200 p-2 text-sm"
                              >
                                {ENGINEERING_UNIT_OPTIONS.map(unit => (
                                  <option key={unit} value={unit}>{unit}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Fonte</label>
                              <select
                                value={item.fonte || normalizedEngineeringDetails.reference_source}
                                onChange={e => updateMaterial(item.id, 'fonte', e.target.value)}
                                className="w-full rounded border border-slate-200 p-2 text-sm"
                              >
                                {ENGINEERING_PRICE_SOURCE_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Código</label>
                              <input
                                value={item.codigo || ''}
                                onChange={e => updateMaterial(item.id, 'codigo', e.target.value)}
                                className="w-full rounded border border-slate-200 p-2 text-sm"
                                placeholder="Código da composição"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">BDI do item (%)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={item.bdi_rate ?? ''}
                                onChange={e => updateMaterial(item.id, 'bdi_rate', e.target.value)}
                                className="w-full rounded border border-slate-200 p-2 text-sm"
                                placeholder={`${normalizedEngineeringDetails.global_bdi || 0}`}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-xs text-slate-500">Memória de cálculo</label>
                              <textarea
                                rows={2}
                                value={item.memoria_calculo || ''}
                                onChange={e => updateMaterial(item.id, 'memoria_calculo', e.target.value)}
                                className="w-full rounded border border-slate-200 p-2 text-sm"
                                placeholder="Ex.: 12 salas x 3 pontos por sala"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      {normalizedEngineeringDetails.enabled && (
                        <div className="grid gap-2 text-xs sm:grid-cols-3">
                          <div className="rounded-lg bg-white p-2">
                            <p className="font-bold text-slate-500">Base</p>
                            <p className="font-black text-slate-900">{formatCurrencyText(getLineBaseTotal(item, 'qtd', 'precoVenda'))}</p>
                          </div>
                          <div className="rounded-lg bg-white p-2">
                            <p className="font-bold text-slate-500">BDI</p>
                            <p className="font-black text-slate-900">{getItemBdiRate(item, normalizedEngineeringDetails).toFixed(2).replace('.', ',')}%</p>
                          </div>
                          <div className="rounded-lg bg-white p-2">
                            <p className="font-bold text-slate-500">Total</p>
                            <p className="font-black text-slate-900">{formatCurrencyText(getLineTotalWithBdi(item, 'qtd', 'precoVenda', normalizedEngineeringDetails))}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => removeMaterial(item.id)}
                          className="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm font-semibold hover:bg-red-100 transition"
                        >
                          🗑️ Remover
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SERVIÇOS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">👷 Serviços ({maoDeObra.length})</h2>
            <button 
              onClick={() => setShowModalServico(true)}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-white text-sm font-semibold transition"
            >
              + Serviço
            </button>
          </div>

          {maoDeObra.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>Nenhum serviço adicionado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {maoDeObra.map(item => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <div className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-slate-900">{item.descricao}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.horas} {item.unidade || 'h'} × R$ {Number(item.valorHora || 0).toFixed(2).replace('.', ',')} = <strong>{formatCurrencyText(getLineTotalWithBdi(item, 'horas', 'valorHora', normalizedEngineeringDetails))}</strong>
                        {normalizedEngineeringDetails.enabled && getItemBdiRate(item, normalizedEngineeringDetails) > 0 ? ` com BDI ${getItemBdiRate(item, normalizedEngineeringDetails).toFixed(2).replace('.', ',')}%` : ''}
                      </p>
                      {normalizedEngineeringDetails.enabled && (item.fonte || item.codigo) && (
                        <p className="mt-1 text-xs font-semibold text-blue-700">
                          {[item.fonte, item.codigo && `Código ${item.codigo}`].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:ml-4">
                      <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                        <button
                          onClick={() => alteraHoras(item.id, -1)}
                          className="w-6 h-6 rounded text-red-600 hover:bg-red-50 text-xs font-bold"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-xs font-semibold">{item.horas}</span>
                        <button
                          onClick={() => alteraHoras(item.id, 1)}
                          className="w-6 h-6 rounded text-green-600 hover:bg-green-50 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedServico(expandedServico === item.id ? null : item.id)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => removeServico(item.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs font-semibold hover:bg-red-100 transition"
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  {expandedServico === item.id && (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <label className="text-xs text-slate-500">Descrição</label>
                          <input
                            value={item.descricao}
                            onChange={e => updateServico(item.id, 'descricao', e.target.value)}
                            className="w-full rounded border border-slate-200 p-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Quantidade/Horas</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.horas}
                            onChange={e => updateServico(item.id, 'horas', e.target.value)}
                            className="w-full rounded border border-slate-200 p-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Valor unitário</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.valorHora}
                            onChange={e => updateServico(item.id, 'valorHora', e.target.value)}
                            className="w-full rounded border border-slate-200 p-2 text-sm"
                          />
                        </div>
                        {normalizedEngineeringDetails.enabled && (
                          <>
                            <div>
                              <label className="text-xs text-slate-500">Unidade</label>
                              <select
                                value={item.unidade || 'h'}
                                onChange={e => updateServico(item.id, 'unidade', e.target.value)}
                                className="w-full rounded border border-slate-200 p-2 text-sm"
                              >
                                {ENGINEERING_UNIT_OPTIONS.map(unit => (
                                  <option key={unit} value={unit}>{unit}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Fonte</label>
                              <select
                                value={item.fonte || normalizedEngineeringDetails.reference_source}
                                onChange={e => updateServico(item.id, 'fonte', e.target.value)}
                                className="w-full rounded border border-slate-200 p-2 text-sm"
                              >
                                {ENGINEERING_PRICE_SOURCE_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Código</label>
                              <input
                                value={item.codigo || ''}
                                onChange={e => updateServico(item.id, 'codigo', e.target.value)}
                                className="w-full rounded border border-slate-200 p-2 text-sm"
                                placeholder="Código da composição"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">BDI do item (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.bdi_rate ?? ''}
                                onChange={e => updateServico(item.id, 'bdi_rate', e.target.value)}
                                className="w-full rounded border border-slate-200 p-2 text-sm"
                                placeholder={`${normalizedEngineeringDetails.global_bdi || 0}`}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-xs text-slate-500">Memória de cálculo</label>
                              <textarea
                                rows={2}
                                value={item.memoria_calculo || ''}
                                onChange={e => updateServico(item.id, 'memoria_calculo', e.target.value)}
                                className="w-full rounded border border-slate-200 p-2 text-sm"
                                placeholder="Ex.: 3 vistorias x 2 horas"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RESUMO */}
        <div className="rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-lg">
          <div className={`grid gap-4 ${normalizedEngineeringDetails.enabled && totalBdi > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <div className="min-w-0">
              <p className="text-xs uppercase text-slate-300">Materiais</p>
              <p className="mt-2 break-words text-2xl font-black">R$ {totalMateriais.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase text-slate-300">Serviços</p>
              <p className="mt-2 break-words text-2xl font-black">R$ {totalMaoDeObra.toFixed(2).replace('.', ',')}</p>
            </div>
            {normalizedEngineeringDetails.enabled && totalBdi > 0 && (
              <div className="min-w-0">
                <p className="text-xs uppercase text-slate-300">BDI</p>
                <p className="mt-2 break-words text-2xl font-black">R$ {totalBdi.toFixed(2).replace('.', ',')}</p>
              </div>
            )}
            <div className="min-w-0 rounded-lg bg-blue-600 p-4">
              <p className="text-xs uppercase text-blue-100">Total</p>
              <p className="mt-2 break-words text-3xl font-black">R$ {totalGeral.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL PRÉVIA DA PROPOSTA */}
      {showProposalPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-slate-50 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: sanitizeHexColor(companyAccentColor, DEFAULT_ACCENT_COLOR) }}>
                  Prévia do cliente
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Como a proposta será vista</h3>
                <p className="mt-1 text-sm text-slate-500">Confira dados, valores, pagamento e condições antes de enviar.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProposalPreview(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-5 p-5">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Empresa</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">{companyName || 'Sua empresa'}</h2>
                    <p className="mt-2 text-sm text-slate-500">{[companyPhone, companyEmail].filter(Boolean).join(' · ') || 'Contato não informado'}</p>
                    <div className="mt-5">
                      <p className="text-xs font-bold uppercase text-slate-500">Cliente</p>
                      <p className="mt-1 text-lg font-black text-slate-950">{cliente?.nome || 'Cliente não selecionado'}</p>
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-5 text-white"
                    style={{ backgroundColor: sanitizeHexColor(companyAccentColor, DEFAULT_ACCENT_COLOR) }}
                  >
                    <p className="text-xs font-bold uppercase opacity-80">Total da proposta</p>
                    <p className="mt-2 text-3xl font-black">{formatCurrencyText(totalGeral)}</p>
                    <p className="mt-3 text-sm opacity-90">{paymentDescription}</p>
                    {normalizedEngineeringDetails.enabled && totalBdi > 0 && (
                      <p className="mt-2 text-sm opacity-90">BDI: {formatCurrencyText(totalBdi)}</p>
                    )}
                  </div>
                </div>
              </section>

              {normalizedEngineeringDetails.enabled && (
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                  <h4 className="font-black text-slate-900">Dados técnicos</h4>
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Objeto</p>
                      <p className="mt-1 font-semibold text-slate-900">{normalizedEngineeringDetails.object || 'Não informado'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Fonte</p>
                      <p className="mt-1 font-semibold text-slate-900">{normalizedEngineeringDetails.reference_source}/{normalizedEngineeringDetails.reference_uf}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Responsável</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {[normalizedEngineeringDetails.responsible_name, normalizedEngineeringDetails.professional_registry].filter(Boolean).join(' · ') || 'Não informado'}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              <section className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <h4 className="font-black text-slate-900">Materiais</h4>
                  <div className="mt-4 space-y-3">
                    {materiais.length === 0 ? (
                      <p className="text-sm text-slate-500">Sem materiais.</p>
                    ) : materiais.map((item, index) => (
                      <div key={`${item.nome}-${index}`} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
                        <div>
                          <p className="font-bold text-slate-900">{item.nome}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.qtd} un x {formatCurrencyText(item.precoVenda)}</p>
                        </div>
                        <p className="font-black text-slate-900">{formatCurrencyText(Number(item.qtd || 0) * Number(item.precoVenda || 0))}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <h4 className="font-black text-slate-900">Serviços</h4>
                  <div className="mt-4 space-y-3">
                    {maoDeObra.length === 0 ? (
                      <p className="text-sm text-slate-500">Sem serviços.</p>
                    ) : maoDeObra.map((item, index) => (
                      <div key={`${item.descricao}-${index}`} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
                        <div>
                          <p className="font-bold text-slate-900">{item.descricao}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.horas} h x {formatCurrencyText(item.valorHora)}</p>
                        </div>
                        <p className="font-black text-slate-900">{formatCurrencyText(Number(item.horas || 0) * Number(item.valorHora || 0))}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <h4 className="font-black text-slate-900">Pagamento</h4>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{paymentDescription}</p>
                  {normalizedPaymentDetails.notes && (
                    <p className="mt-2 text-sm text-slate-500">{normalizedPaymentDetails.notes}</p>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <h4 className="font-black text-slate-900">Aceite do cliente</h4>
                  <div className="mt-3 space-y-2 opacity-70">
                    <input disabled value="" placeholder="Nome completo do cliente" className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input disabled type="checkbox" />
                      Aceito as condições desta proposta.
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h4 className="font-black text-slate-900">Condições</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {String(companyTerms || DEFAULT_COMPANY_TERMS).split('\n').map(line => line.trim()).filter(Boolean).map(line => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setShowProposalPreview(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Continuar editando
                </button>
                <button
                  type="button"
                  onClick={enviarProposta}
                  disabled={!cliente || sendingProposal || publishingPublicLink}
                  className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {sendingProposal ? 'Preparando...' : 'Salvar, gerar link e enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTÓRICO DE VERSÕES */}
      {showRevisionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
              <div>
                <p className="text-xs font-bold uppercase text-blue-600">Histórico</p>
                <h3 className="text-lg font-black text-slate-900">Versões do orçamento</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Cada versão abaixo é um retrato salvo antes de uma alteração.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRevisionHistory(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-3 p-5">
              {loadingRevisions ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Carregando histórico...</p>
              ) : revisionHistory.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  Este orçamento ainda não tem versões anteriores.
                </p>
              ) : revisionHistory.map((revision) => {
                const snapshot = revision.snapshot || {};
                const changedAt = revision.changed_at ? new Date(revision.changed_at).toLocaleString('pt-BR') : 'Data não informada';
                const totalSnapshot = Number(snapshot.total || 0).toFixed(2).replace('.', ',');
                const changedFields = (revision.changed_fields || []).join(', ') || 'campos do orçamento';

                return (
                  <div key={revision.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="font-black text-slate-900">
                          Versão {revision.revision_number || '-'}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">{changedAt}</p>
                      </div>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${getOrcamentoStatusClass(snapshot.status)}`}>
                        {getOrcamentoStatusLabel(snapshot.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-bold uppercase text-slate-500">Total anterior</p>
                        <p className="mt-1 font-black text-slate-900">R$ {totalSnapshot}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-bold uppercase text-slate-500">Materiais</p>
                        <p className="mt-1 font-black text-slate-900">{(snapshot.itens || []).length}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-bold uppercase text-slate-500">Serviços</p>
                        <p className="mt-1 font-black text-slate-900">{(snapshot.servicos || []).length}</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      Alteração registrada em: {changedFields}.
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL MATERIAL */}
      {showModalMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Novo Material</h3>
            <div className="space-y-3">
              <input 
                value={novoMaterial.nome}
                onChange={e => setNovoMaterial({...novoMaterial, nome: e.target.value})}
                type="text"
                placeholder="Nome do material"
                className="w-full p-2 rounded border border-slate-200 text-sm"
              />
              <input 
                value={novoMaterial.qtd}
                onChange={e => setNovoMaterial({...novoMaterial, qtd: Number(e.target.value)})}
                type="number"
                min="1"
                placeholder="Quantidade"
                className="w-full p-2 rounded border border-slate-200 text-sm"
              />
              <input 
                value={novoMaterial.precoVenda}
                onChange={e => setNovoMaterial({...novoMaterial, precoVenda: e.target.value})}
                type="number"
                step="0.01"
                placeholder="Preço de venda"
                className="w-full p-2 rounded border border-slate-200 text-sm"
                min="0"
              />
              <input 
                value={novoMaterial.custo}
                onChange={e => setNovoMaterial({...novoMaterial, custo: e.target.value})}
                type="number"
                step="0.01"
                placeholder="Custo (opcional)"
                className="w-full p-2 rounded border border-slate-200 text-sm"
                min="0"
              />
              {normalizedEngineeringDetails.enabled && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={novoMaterial.unidade}
                    onChange={e => setNovoMaterial({...novoMaterial, unidade: e.target.value})}
                    className="w-full rounded border border-slate-200 p-2 text-sm"
                  >
                    {ENGINEERING_UNIT_OPTIONS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                  <select
                    value={novoMaterial.fonte}
                    onChange={e => setNovoMaterial({...novoMaterial, fonte: e.target.value})}
                    className="w-full rounded border border-slate-200 p-2 text-sm"
                  >
                    {ENGINEERING_PRICE_SOURCE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input
                    value={novoMaterial.codigo}
                    onChange={e => setNovoMaterial({...novoMaterial, codigo: e.target.value})}
                    type="text"
                    placeholder="Código da composição"
                    className="w-full rounded border border-slate-200 p-2 text-sm"
                  />
                  <input
                    value={novoMaterial.bdi_rate}
                    onChange={e => setNovoMaterial({...novoMaterial, bdi_rate: e.target.value})}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="BDI do item (%)"
                    className="w-full rounded border border-slate-200 p-2 text-sm"
                  />
                  <textarea
                    value={novoMaterial.memoria_calculo}
                    onChange={e => setNovoMaterial({...novoMaterial, memoria_calculo: e.target.value})}
                    rows={2}
                    placeholder="Memória de cálculo"
                    className="w-full rounded border border-slate-200 p-2 text-sm sm:col-span-2"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setShowModalMaterial(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddMaterial}
                className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SERVIÇO */}
      {showModalServico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Novo Serviço</h3>
            <div className="space-y-3">
              <input 
                value={novoServico.descricao}
                onChange={e => setNovoServico({...novoServico, descricao: e.target.value})}
                type="text"
                placeholder="Descrição do serviço"
                className="w-full p-2 rounded border border-slate-200 text-sm"
              />
              <input 
                value={novoServico.horas}
                onChange={e => setNovoServico({...novoServico, horas: Number(e.target.value)})}
                type="number"
                min="1"
                placeholder="Horas"
                className="w-full p-2 rounded border border-slate-200 text-sm"
              />
              <input 
                value={novoServico.valorHora}
                onChange={e => setNovoServico({...novoServico, valorHora: e.target.value})}
                type="number"
                step="0.01"
                placeholder="Valor por hora"
                className="w-full p-2 rounded border border-slate-200 text-sm"
                min="0"
              />
              {normalizedEngineeringDetails.enabled && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={novoServico.unidade}
                    onChange={e => setNovoServico({...novoServico, unidade: e.target.value})}
                    className="w-full rounded border border-slate-200 p-2 text-sm"
                  >
                    {ENGINEERING_UNIT_OPTIONS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                  <select
                    value={novoServico.fonte}
                    onChange={e => setNovoServico({...novoServico, fonte: e.target.value})}
                    className="w-full rounded border border-slate-200 p-2 text-sm"
                  >
                    {ENGINEERING_PRICE_SOURCE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input
                    value={novoServico.codigo}
                    onChange={e => setNovoServico({...novoServico, codigo: e.target.value})}
                    type="text"
                    placeholder="Código da composição"
                    className="w-full rounded border border-slate-200 p-2 text-sm"
                  />
                  <input
                    value={novoServico.bdi_rate}
                    onChange={e => setNovoServico({...novoServico, bdi_rate: e.target.value})}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="BDI do item (%)"
                    className="w-full rounded border border-slate-200 p-2 text-sm"
                  />
                  <textarea
                    value={novoServico.memoria_calculo}
                    onChange={e => setNovoServico({...novoServico, memoria_calculo: e.target.value})}
                    rows={2}
                    placeholder="Memória de cálculo"
                    className="w-full rounded border border-slate-200 p-2 text-sm sm:col-span-2"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setShowModalServico(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddServico}
                className="flex-1 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CALCULADORA DE MATERIAIS */}
      {showMaterialCalculator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Calculadora de materiais</h3>
                  <p className="text-sm text-slate-500">Informe metragem e quantidade de pontos para o sistema estimar materiais e mão de obra.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMaterialCalculator(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[340px_1fr]">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">
                  Tipo de serviço
                  <select
                    value={calculatorForm.tipo}
                    onChange={e => changeCalculatorType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {materialCalculatorTemplates.map(template => (
                      <option key={template.id} value={template.id}>{template.nome}</option>
                    ))}
                  </select>
                </label>

                <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{calculatorTemplate.help}</p>

                <label className="block text-sm font-bold text-slate-700">
                  {calculatorTemplate.pontoLabel}
                  <input
                    type="number"
                    min="1"
                    value={calculatorForm.pontos}
                    onChange={e => updateCalculatorForm('pontos', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  {calculatorTemplate.distanciaLabel}
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={calculatorForm.distanciaMetros}
                    onChange={e => updateCalculatorForm('distanciaMetros', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Reserva técnica (%)
                  <input
                    type="number"
                    min="0"
                    value={calculatorForm.reservaPercentual}
                    onChange={e => updateCalculatorForm('reservaPercentual', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(calculatorForm.circuitoNovo)}
                    onChange={e => updateCalculatorForm('circuitoNovo', e.target.checked)}
                    className="h-4 w-4"
                  />
                  Incluir disjuntor/circuito novo
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(calculatorForm.incluirAparelho)}
                    onChange={e => updateCalculatorForm('incluirAparelho', e.target.checked)}
                    className="h-4 w-4"
                  />
                  Incluir aparelho/acabamento principal
                </label>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Materiais</p>
                    <p className="mt-1 text-xl font-black text-slate-900">R$ {calculatorTotals.totalMateriais.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Serviços</p>
                    <p className="mt-1 text-xl font-black text-slate-900">R$ {calculatorTotals.totalMaoDeObra.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-bold uppercase text-emerald-700">Total estimado</p>
                    <p className="mt-1 text-xl font-black text-emerald-950">R$ {calculatorTotals.totalGeral.toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h4 className="font-bold text-slate-900">Como o cálculo foi feito</h4>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {calculatorPlan.resumo.map(line => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h4 className="font-bold text-slate-900">Materiais calculados</h4>
                    <div className="mt-3 space-y-2">
                      {calculatorPlan.materiais.map(material => (
                        <div key={`${material.nome}-${material.qtd}`} className="rounded-lg bg-slate-50 p-3 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="font-semibold text-slate-800">{material.nome}</span>
                            <span className="font-black text-slate-900">{material.qtd}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{material.observacao}</p>
                          <p className="mt-1 text-xs font-bold text-slate-700">
                            R$ {(material.qtd * material.precoVenda).toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <h4 className="font-bold text-slate-900">Mão de obra sugerida</h4>
                    <div className="mt-3 space-y-2">
                      {calculatorPlan.servicos.map(servico => (
                        <div key={servico.descricao} className="rounded-lg bg-slate-50 p-3 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="font-semibold text-slate-800">{servico.descricao}</span>
                            <span className="font-black text-slate-900">{servico.horas}h</span>
                          </div>
                          <p className="mt-1 text-xs font-bold text-slate-700">
                            R$ {(servico.horas * servico.valorHora).toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addCalculatorPlan}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
                >
                  Adicionar cálculo ao orçamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* MODAL CONFIGURAÇÕES DA EMPRESA */}
      {showModalCompanyDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Dados da Sua Empresa</h3>
            <div className="space-y-3">
              <input 
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                type="text"
                placeholder="Nome da Empresa"
                className="w-full p-2 rounded border border-slate-200 text-sm"
              />
              <input 
                value={companyAddress}
                onChange={e => setCompanyAddress(e.target.value)}
                type="text"
                placeholder="Endereço completo"
                className="w-full p-2 rounded border border-slate-200 text-sm"
              />
              <input 
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                type="text"
                placeholder="Telefone / WhatsApp"
                className="w-full p-2 rounded border border-slate-200 text-sm"
              />
              <input 
                value={companyEmail}
                onChange={e => setCompanyEmail(e.target.value)}
                type="email"
                placeholder="Email de contato"
                className="w-full p-2 rounded border border-slate-200 text-sm"
              />
              <label className="block text-sm font-bold text-slate-700">
                Cor da proposta
                <div className="mt-1 flex gap-2">
                  <input
                    value={sanitizeHexColor(companyAccentColor, DEFAULT_ACCENT_COLOR)}
                    onChange={e => setCompanyAccentColor(e.target.value)}
                    type="color"
                    className="h-10 w-14 rounded border border-slate-200 bg-white p-1"
                  />
                  <input
                    value={companyAccentColor}
                    onChange={e => setCompanyAccentColor(e.target.value)}
                    type="text"
                    placeholder="#2563eb"
                    className="w-full rounded border border-slate-200 p-2 text-sm"
                  />
                </div>
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Condições da proposta
                <textarea
                  value={companyTerms}
                  onChange={e => setCompanyTerms(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded border border-slate-200 p-2 text-sm"
                  placeholder={DEFAULT_COMPANY_TERMS}
                />
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setShowModalCompanyDetails(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button 
                onClick={saveCompanyDetails}
                className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition"
              >
                Salvar Dados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING BUTTON IA */}
      <button
        type="button"
        onClick={showAiSoon}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-3 text-sm font-black text-violet-700 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl"
        title="Assistente de IA em breve"
      >
        <span className="text-lg">✨</span>
        <span>IA em breve</span>
      </button>

      {/* PDF SECTION NO LONGER NEEDED - Using jsPDF instead of html2pdf */}
    </div>
  );
}
