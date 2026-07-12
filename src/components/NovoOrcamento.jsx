import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { useOrcamentos } from '../useOrcamentos';
import { useClientes } from '../useClientes';
import { auth, db, functions } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
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
  buildPublicOrcamentoUrl,
  createShareToken,
  getDefaultValidUntil,
  hexToRgb,
  sanitizeHexColor,
} from '../publicOrcamento';

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
  const [materiaisDraft, setMateriaisDraft] = useState({ key: draftKey, value: null });
  const [maoDeObraDraft, setMaoDeObraDraft] = useState({ key: draftKey, value: null });
  const materiais = getDraftValue(materiaisDraft, draftKey, baseDraftItems.materiais);
  const maoDeObra = getDraftValue(maoDeObraDraft, draftKey, baseDraftItems.maoDeObra);

  const setMateriais = useCallback((updater) => {
    setMateriaisDraft((previousDraft) => nextDraftState(previousDraft, draftKey, baseDraftItems.materiais, updater));
  }, [draftKey, baseDraftItems.materiais]);

  const setMaoDeObra = useCallback((updater) => {
    setMaoDeObraDraft((previousDraft) => nextDraftState(previousDraft, draftKey, baseDraftItems.maoDeObra, updater));
  }, [draftKey, baseDraftItems.maoDeObra]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showModalMaterial, setShowModalMaterial] = useState(false);
  const [showModalServico, setShowModalServico] = useState(false);
  const [novoMaterial, setNovoMaterial] = useState({ nome: '', qtd: 1, precoVenda: '', custo: '' });
  const [novoServico, setNovoServico] = useState({ descricao: '', horas: 1, valorHora: '' });
  const [expandedMaterial, setExpandedMaterial] = useState(null);
  const [catalogMode, setCatalogMode] = useState('materiais');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('todos');
  const [catalogOverrides, setCatalogOverrides] = useState({ materiais: {}, servicos: {}, pacotes: {} });
  const [catalogDrafts, setCatalogDrafts] = useState({});
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
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAccentColor, setCompanyAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [companyTerms, setCompanyTerms] = useState(DEFAULT_COMPANY_TERMS);
  const [publishingPublicLink, setPublishingPublicLink] = useState(false);

  const [showModalAI, setShowModalAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
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

  const gerarComIA = async () => {
    if (!aiPrompt) return;
    
    setIsGeneratingAI(true);
    try {
      // Chamada para a Cloud Function segura
      const callGerarOrcamento = httpsCallable(functions, 'gerarOrcamentoComIA');
      const result = await callGerarOrcamento({ prompt: aiPrompt });
      const parsed = result.data;
      
      // Função auxiliar para buscar preço real na nossa API interna
      const buscarPrecoReal = async (nome) => {
        try {
          const res = await fetch(`/api/comparar-precos?q=${encodeURIComponent(nome)}`);
          const searchData = await res.json();
          if (searchData.items && searchData.items.length > 0) {
            // Pega o primeiro resultado (mais relevante)
            return searchData.items[0].price;
          }
        } catch (error) {
          console.error("Erro ao buscar preço real para:", nome, error);
        }
        return null;
      };

      if (parsed.materiais) {
        // Mapeia os materiais e tenta atualizar o preço de cada um
        const firstMaterialId = nextNumericId(materiais);
        const materiaisComPrecoReal = await Promise.all(parsed.materiais.map(async (m, i) => {
          const precoReal = await buscarPrecoReal(m.nome);
          const precoFinal = precoReal || m.precoVenda;
          return {
            ...m,
            id: firstMaterialId + i,
            precoVenda: precoFinal,
            custo: precoFinal * 0.8,
            precoInternet: precoReal ? precoReal : (m.precoVenda * 0.9)
          };
        }));
        setMateriais(prev => [...prev, ...materiaisComPrecoReal]);
      }
      if (parsed.servicos) {
        const firstServicoId = nextNumericId(maoDeObra);
        setMaoDeObra(prev => [...prev, ...parsed.servicos.map((s, i) => ({
          ...s,
          id: firstServicoId + i
        }))]);
      }
      setShowModalAI(false);
      setAiPrompt('');
    } catch (error) {
      console.error('Erro na IA:', error);
      toast.error('Erro ao gerar com IA. Verifique sua chave da API ou tente novamente.');
    } finally {
      setIsGeneratingAI(false);
    }
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
        precoInternet: estimateInternetPrice(novoMaterial.nome, novoMaterial.precoVenda)
      }
    ]);

    setNovoMaterial({ nome: '', qtd: 1, precoVenda: '', custo: '' });
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
        valorHora: Number(novoServico.valorHora)
      }
    ]);

    setNovoServico({ descricao: '', horas: 1, valorHora: '' });
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
        precoInternet: estimateInternetPrice(material.nome, material.precoVenda)
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
        valorHora: Number(servico.valorHora || 0)
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
            precoInternet: estimateInternetPrice(customMaterial.nome, customMaterial.precoVenda)
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
            valorHora: Number(customServico.valorHora || 0)
          };
        })
      ];
    });

    showCatalogFeedback(`${pacote.nome} adicionado ao orçamento.`);
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
    setMateriais(materiais.map(item => item.id === id ? { ...item, [field]: field === 'nome' ? value : Number(value) } : item));
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
          pdf.text(String(item.qtd), 130, yPosition + 5.5, { align: 'right' });
          pdf.text(`R$ ${item.precoVenda.toFixed(2).replace('.', ',')}`, 160, yPosition + 5.5, { align: 'right' });
          pdf.text(`R$ ${(item.qtd * item.precoVenda).toFixed(2).replace('.', ',')}`, pageWidth - marginX - 3, yPosition + 5.5, { align: 'right' });
          
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
          pdf.text(String(item.horas), 130, yPosition + 5.5, { align: 'right' });
          pdf.text(`R$ ${item.valorHora.toFixed(2).replace('.', ',')}`, 160, yPosition + 5.5, { align: 'right' });
          pdf.text(`R$ ${(item.horas * item.valorHora).toFixed(2).replace('.', ',')}`, pageWidth - marginX - 3, yPosition + 5.5, { align: 'right' });
          
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
      const summaryBoxH = 30;
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
      
      pdf.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.line(summaryBoxX + 5, yPosition + 18, summaryBoxX + summaryBoxW - 5, yPosition + 18);
  
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('TOTAL:', summaryBoxX + 5, yPosition + 25);
      pdf.text(`R$ ${totalGeral.toFixed(2).replace('.', ',')}`, summaryBoxX + summaryBoxW - 5, yPosition + 25, { align: 'right' });

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

  const { totalMateriais, totalMaoDeObra, totalGeral } = calculateOrcamentoTotals(materiais, maoDeObra);

  const normalizeWhatsAppPhone = (phone = '') => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55')) return digits;
    return `55${digits}`;
  };

  const buildShareMessage = () => {
    const numero = orcamentoExistente?.numero ? String(orcamentoExistente.numero).padStart(4, '0') : 'novo';
    const publicUrl = orcamentoExistente?.public_url;
    const linhas = [
      `Olá, ${cliente?.nome || 'tudo bem'}!`,
      `${companyName || 'Nossa equipe'} preparou o orçamento #${numero}.`,
      `Materiais: R$ ${totalMateriais.toFixed(2).replace('.', ',')}`,
      `Serviços: R$ ${totalMaoDeObra.toFixed(2).replace('.', ',')}`,
      `Total: R$ ${totalGeral.toFixed(2).replace('.', ',')}`,
      publicUrl ? `Aprove ou acompanhe por aqui: ${publicUrl}` : '',
      'O orçamento é válido por 15 dias. Posso tirar alguma dúvida?'
    ].filter(Boolean);

    return linhas.join('\n');
  };

  const publishApprovalLink = async () => {
    if (!orcamentoId) {
      toast.error('Salve o orçamento antes de gerar o link de aprovação.');
      return;
    }

    if (!cliente) {
      toast.error('Selecione um cliente antes de gerar o link.');
      return;
    }

    const ownerId = userId || auth.currentUser?.uid;
    if (!ownerId) {
      toast.error('Usuário não autenticado.');
      return;
    }

    setPublishingPublicLink(true);
    try {
      const now = new Date().toISOString();
      const token = orcamentoExistente?.share_token || createShareToken();
      const publicUrl = buildPublicOrcamentoUrl(token);
      const currentOrcamentoStatus = normalizeOrcamentoStatus(orcamentoExistente?.status);
      const statusToPublish = currentOrcamentoStatus === ORCAMENTO_STATUS.draft
        ? ORCAMENTO_STATUS.sent
        : currentOrcamentoStatus;

      await setDoc(doc(db, 'public_orcamentos', token), {
        user_id: ownerId,
        orcamento_id: String(orcamentoId),
        share_token: token,
        public_url: publicUrl,
        numero: orcamentoExistente?.numero || null,
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
        itens: materiais,
        servicos: maoDeObra,
        total: totalGeral,
        total_materiais: totalMateriais,
        total_servicos: totalMaoDeObra,
        valid_until: getDefaultValidUntil(),
        published_at: orcamentoExistente?.published_at || now,
        updated_at: now,
      }, { merge: true });

      await updateOrcamento(orcamentoId, {
        share_token: token,
        public_url: publicUrl,
        public_updated_at: now,
        status: statusToPublish,
      });

      try {
        await navigator.clipboard.writeText(publicUrl);
        toast.success('Link de aprovação copiado.');
      } catch {
        toast.success('Link de aprovação gerado.');
      }
    } catch (error) {
      console.error('Erro ao publicar link de aprovação:', error);
      toast.error(`Erro ao gerar link: ${error.message || 'Tente novamente'}`);
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
    if (!resolvedClienteId) {
      toast.error('Selecione um cliente para salvar o orçamento.');
      return;
    }

    try {
      if (orcamentoId) {
        // Editar
        await updateOrcamento(orcamentoId, {
          itens: materiais,
          servicos: maoDeObra,
          total: totalGeral
        });
        toast.success('Orçamento atualizado com sucesso.');
      } else {
        // Criar novo
          const novoOrc = await addOrcamento({
          cliente_id: resolvedClienteId,
          itens: materiais,
          servicos: maoDeObra,
          total: totalGeral,
          status: ORCAMENTO_STATUS.draft
        });
        toast.success('Orçamento salvo com sucesso.');
          // Redireciona de forma silenciosa para o link da edição sem tirar o usuário da tela
          navigate(`/orcamento/editar/${novoOrc.id}`, { replace: true });
      }
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
                onClick={publishApprovalLink}
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
                        {item.qtd} un × R$ {item.precoVenda.toFixed(2).replace('.', ',')} = <strong>R$ {(item.qtd * item.precoVenda).toFixed(2).replace('.', ',')}</strong>
                      </p>
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
                      </div>
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
                <div key={item.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-slate-900">{item.descricao}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.horas} h × R$ {item.valorHora.toFixed(2).replace('.', ',')} = <strong>R$ {(item.horas * item.valorHora).toFixed(2).replace('.', ',')}</strong>
                    </p>
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
                      onClick={() => removeServico(item.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs font-semibold hover:bg-red-100 transition"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RESUMO */}
        <div className="rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-lg">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <p className="text-xs uppercase text-slate-300">Materiais</p>
              <p className="mt-2 break-words text-2xl font-black">R$ {totalMateriais.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase text-slate-300">Serviços</p>
              <p className="mt-2 break-words text-2xl font-black">R$ {totalMaoDeObra.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="min-w-0 rounded-lg bg-blue-600 p-4">
              <p className="text-xs uppercase text-blue-100">Total</p>
              <p className="mt-2 break-words text-3xl font-black">R$ {totalGeral.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
        </div>
      </main>

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

      {/* MODAL IA */}
      {showModalAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl border border-purple-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-100 p-2 rounded-full">
                ✨
              </div>
              <h3 className="text-xl font-bold text-slate-900">Assistente de IA</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">Descreva o serviço ou problema do cliente, e a IA irá sugerir materiais e mão de obra automaticamente.</p>
            
            <div className="space-y-4">
              <textarea 
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Ex: Preciso instalar um chuveiro 220v com disjuntor novo e trocar a fiação de 6mm por 10 metros..."
                className="w-full p-3 rounded-lg border border-slate-200 text-sm h-32 resize-none focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowModalAI(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold hover:bg-slate-50 transition text-slate-700"
              >
                Cancelar
              </button>
              <button 
                onClick={gerarComIA}
                disabled={isGeneratingAI || !aiPrompt}
                className="flex-[2] rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 text-sm font-bold hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
              >
                {isGeneratingAI ? '⏳ Gerando Orçamento...' : '✨ Gerar Orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING BUTTON IA */}
      <button
        onClick={() => setShowModalAI(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full p-4 shadow-xl hover:shadow-2xl hover:scale-105 transition transform flex items-center justify-center"
        title="Assistente de Orçamento por IA"
      >
        <span className="text-2xl">✨</span>
      </button>

      {/* PDF SECTION NO LONGER NEEDED - Using jsPDF instead of html2pdf */}
    </div>
  );
}
