import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { useClientes } from '../useClientes';
import { useOrcamentos } from '../useOrcamentos';
import { useEngineering } from '../useEngineering';
import {
  DEFAULT_PROFESSIONAL_PROFILE,
  DEFAULT_PROJECT_FORM,
  DOCUMENT_BLOCK_LIBRARY,
  DOCUMENT_TEMPLATES,
  DOCUMENT_WIZARD_STEPS,
  ENGINEERING_ACTIONS,
  ENGINEERING_DOCUMENT_STATUS,
  ENGINEERING_DOCUMENT_STATUS_OPTIONS,
  ENGINEERING_MODULE_TABS,
  FIELD_GUIDES,
  createDraftFromTemplate,
  createLocalId,
  createVerificationCode,
  getDocumentStatusClass,
  getDocumentStatusLabel,
  getDocumentTemplate,
  normalizeDocumentDraft,
} from '../engineeringDocuments';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR');

const getToday = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return dateFormatter.format(date);
};

const getActionToneClass = (tone) => {
  const classes = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
    slate: 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    red: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
    violet: 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100',
    green: 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100',
    orange: 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100',
    sky: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
  };

  return classes[tone] || classes.slate;
};

const getCompletionScore = (documentDraft) => {
  const checks = [
    documentDraft.type,
    documentDraft.cliente_id,
    documentDraft.project_id,
    documentDraft.object,
    documentDraft.inspection_date,
    documentDraft.findings,
    documentDraft.analysis,
    documentDraft.recommendations,
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
};

const toTextLines = (value) => String(value || '')
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean);

const loadImageAsDataUrl = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível carregar a foto no PDF.'));
    reader.readAsDataURL(blob);
  });
};

export default function EngineeringPage() {
  const { clientes } = useClientes();
  const { orcamentos } = useOrcamentos();
  const {
    professionalProfile,
    projects,
    documents,
    loading,
    saveProfessionalProfile,
    addProject,
    saveDocument,
    uploadDocumentPhoto,
  } = useEngineering();

  const [activeTab, setActiveTab] = useState('overview');
  const [profileOverrides, setProfileOverrides] = useState({});
  const [projectForm, setProjectForm] = useState(DEFAULT_PROJECT_FORM);
  const [documentDraft, setDocumentDraft] = useState(() => {
    const savedDraft = localStorage.getItem('orcaja:engineering:document-draft');
    if (savedDraft) {
      try {
        return normalizeDocumentDraft(JSON.parse(savedDraft));
      } catch {
        localStorage.removeItem('orcaja:engineering:document-draft');
      }
    }

    return createDraftFromTemplate('vistoria');
  });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    localStorage.setItem('orcaja:engineering:document-draft', JSON.stringify(documentDraft));
  }, [documentDraft]);

  const baseProfileForm = useMemo(() => ({
    ...DEFAULT_PROFESSIONAL_PROFILE,
    ...(professionalProfile || {}),
    show_fields: {
      ...DEFAULT_PROFESSIONAL_PROFILE.show_fields,
      ...(professionalProfile?.show_fields || {}),
    },
  }), [professionalProfile]);

  const profileForm = useMemo(() => ({
    ...baseProfileForm,
    ...profileOverrides,
    show_fields: {
      ...baseProfileForm.show_fields,
      ...(profileOverrides.show_fields || {}),
    },
  }), [baseProfileForm, profileOverrides]);

  const clientsById = useMemo(() => {
    return clientes.reduce((acc, cliente) => {
      acc[String(cliente.id)] = cliente;
      return acc;
    }, {});
  }, [clientes]);

  const projectsById = useMemo(() => {
    return projects.reduce((acc, project) => {
      acc[String(project.id)] = project;
      return acc;
    }, {});
  }, [projects]);

  const budgetsById = useMemo(() => {
    return orcamentos.reduce((acc, orcamento) => {
      acc[String(orcamento.id)] = orcamento;
      return acc;
    }, {});
  }, [orcamentos]);

  const selectedClient = clientsById[String(documentDraft.cliente_id)] || null;
  const selectedProject = projectsById[String(documentDraft.project_id)] || null;
  const selectedBudget = budgetsById[String(documentDraft.orcamento_id)] || null;

  const metrics = useMemo(() => {
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const deliveredThisMonth = documents.filter((documentItem) => {
      if (documentItem.status !== ENGINEERING_DOCUMENT_STATUS.delivered) return false;
      const date = new Date(documentItem.updated_at || documentItem.created_at);
      return date.getMonth() === month && date.getFullYear() === year;
    }).length;

    return {
      activeProjects: projects.filter(project => project.situation !== 'arquivado').length,
      draftDocuments: documents.filter(documentItem => documentItem.status === ENGINEERING_DOCUMENT_STATUS.draft).length,
      reviewDocuments: documents.filter(documentItem => documentItem.status === ENGINEERING_DOCUMENT_STATUS.review).length,
      deliveredThisMonth,
      pendingArt: projects.filter(project => project.art_number && project.art_status !== 'regular').length,
      openNonConformities: documents.filter(documentItem => documentItem.type === 'nao_conformidade' && ![
        ENGINEERING_DOCUMENT_STATUS.delivered,
        ENGINEERING_DOCUMENT_STATUS.archived,
      ].includes(documentItem.status)).length,
      pendingProposals: orcamentos.filter(orcamento => ['rascunho', 'enviado', 'visualizado'].includes(orcamento.status)).length,
      approvedBudgetValue: orcamentos
        .filter(orcamento => ['aprovado', 'concluído', 'concluido'].includes(orcamento.status))
        .reduce((acc, orcamento) => acc + Number(orcamento.total || 0), 0),
    };
  }, [documents, orcamentos, projects]);

  const updateProfileField = (field, value) => {
    setProfileOverrides(prev => ({ ...prev, [field]: value }));
  };

  const updateProfileVisibility = (field, value) => {
    setProfileOverrides(prev => ({
      ...prev,
      show_fields: {
        ...prev.show_fields,
        [field]: value,
      },
    }));
  };

  const updateProjectField = (field, value) => {
    setProjectForm(prev => ({ ...prev, [field]: value }));
  };

  const updateProjectProperty = (field, value) => {
    setProjectForm(prev => ({
      ...prev,
      property: {
        ...prev.property,
        [field]: value,
      },
    }));
  };

  const updateDocumentField = (field, value) => {
    setDocumentDraft(prev => normalizeDocumentDraft({ ...prev, [field]: value }));
  };

  const updateDocumentArt = (field, value) => {
    setDocumentDraft(prev => normalizeDocumentDraft({
      ...prev,
      art: {
        ...prev.art,
        [field]: value,
      },
    }));
  };

  const updatePhoto = (photoId, field, value) => {
    setDocumentDraft(prev => normalizeDocumentDraft({
      ...prev,
      photos: prev.photos.map(photo => (
        photo.id === photoId ? { ...photo, [field]: value } : photo
      )),
    }));
  };

  const removePhoto = (photoId) => {
    setDocumentDraft(prev => normalizeDocumentDraft({
      ...prev,
      photos: prev.photos.filter(photo => photo.id !== photoId),
    }));
  };

  const toggleDocumentBlock = (blockId) => {
    setDocumentDraft(prev => {
      const enabled = new Set(prev.enabled_blocks || []);
      if (enabled.has(blockId)) {
        enabled.delete(blockId);
      } else {
        enabled.add(blockId);
      }

      return normalizeDocumentDraft({
        ...prev,
        enabled_blocks: [...enabled],
      });
    });
  };

  const startDocument = (type, sourceDocument = null) => {
    if (sourceDocument) {
      setDocumentDraft(normalizeDocumentDraft({
        ...sourceDocument,
        id: undefined,
        title: `${sourceDocument.title || 'Documento'} - cópia`,
        status: ENGINEERING_DOCUMENT_STATUS.draft,
        version: '1.0',
        local_draft_id: createLocalId(),
      }));
    } else {
      const draft = createDraftFromTemplate(type);
      setDocumentDraft({
        ...draft,
        inspection_date: getToday(),
        cliente_id: clientes[0]?.id || '',
      });
    }
    setWizardStep(0);
    setWizardOpen(true);
    setActiveTab('documents');
  };

  const editDocument = (documentItem) => {
    setDocumentDraft(normalizeDocumentDraft(documentItem));
    setWizardStep(1);
    setWizardOpen(true);
    setActiveTab('documents');
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await saveProfessionalProfile(profileForm);
      setProfileOverrides({});
      toast.success('Perfil técnico salvo.');
    } catch (error) {
      toast.error(`Erro ao salvar perfil: ${error.message || 'Tente novamente'}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveProject = async (event) => {
    event.preventDefault();
    if (!projectForm.title || !projectForm.cliente_id) {
      toast.error('Informe título e cliente do projeto.');
      return;
    }

    setSavingProject(true);
    try {
      await addProject({
        ...projectForm,
        contract_value: Number(projectForm.contract_value || 0),
      });
      setProjectForm(DEFAULT_PROJECT_FORM);
      toast.success('Obra/projeto cadastrado.');
    } catch (error) {
      toast.error(`Erro ao salvar projeto: ${error.message || 'Tente novamente'}`);
    } finally {
      setSavingProject(false);
    }
  };

  const handleSaveDocument = async (nextStatus = documentDraft.status) => {
    if (!documentDraft.title || !documentDraft.cliente_id) {
      toast.error('Informe tipo de documento e cliente.');
      return null;
    }

    setSavingDocument(true);
    try {
      const savedDocument = await saveDocument({
        ...documentDraft,
        status: nextStatus,
        completion_score: getCompletionScore(documentDraft),
      });
      setDocumentDraft(normalizeDocumentDraft(savedDocument));
      localStorage.setItem('orcaja:engineering:document-draft', JSON.stringify(savedDocument));
      toast.success(nextStatus === ENGINEERING_DOCUMENT_STATUS.review ? 'Documento enviado para revisão.' : 'Documento técnico salvo.');
      return savedDocument;
    } catch (error) {
      toast.error(`Erro ao salvar documento: ${error.message || 'Tente novamente'}`);
      return null;
    } finally {
      setSavingDocument(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setUploadingPhotos(true);
    try {
      const uploadedPhotos = [];
      for (const file of files) {
        const uploadedPhoto = await uploadDocumentPhoto({
          file,
          documentId: documentDraft.id,
          localDraftId: documentDraft.local_draft_id,
        });
        uploadedPhotos.push({
          ...uploadedPhoto,
          sequence: documentDraft.photos.length + uploadedPhotos.length + 1,
          caption: `Foto ${String(documentDraft.photos.length + uploadedPhotos.length + 1).padStart(2, '0')}`,
          environment: '',
          category: 'evidência',
          observed_fact: '',
          reported_information: '',
          technical_hypothesis: '',
          confirmed_conclusion: '',
        });
      }

      setDocumentDraft(prev => normalizeDocumentDraft({
        ...prev,
        photos: [...prev.photos, ...uploadedPhotos],
      }));
      toast.success(`${uploadedPhotos.length} foto(s) adicionada(s).`);
    } catch (error) {
      toast.error(`Erro no upload: ${error.message || 'Ative o Firebase Storage e tente novamente.'}`);
    } finally {
      setUploadingPhotos(false);
      event.target.value = '';
    }
  };

  const generateDocumentPdf = async (targetDocument = documentDraft) => {
    const documentData = normalizeDocumentDraft(targetDocument);
    const clientData = clientsById[String(documentData.cliente_id)] || selectedClient || {};
    const projectData = projectsById[String(documentData.project_id)] || selectedProject || {};
    const budgetData = budgetsById[String(documentData.orcamento_id)] || selectedBudget || {};
    const profileData = profileForm || DEFAULT_PROFESSIONAL_PROFILE;
    const verificationCode = createVerificationCode([
      documentData.id || documentData.local_draft_id,
      documentData.version,
      documentData.updated_at,
      documentData.title,
    ]);

    setGeneratingPdf(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 16;
      let y = 18;

      const checkPageBreak = (height = 16) => {
        if (y + height > pageHeight - 22) {
          pdf.addPage();
          y = 20;
        }
      };

      const drawHeader = () => {
        pdf.setFillColor(15, 23, 42);
        pdf.rect(0, 0, pageWidth, 11, 'F');
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text(profileData.company_name || 'OrçaJá Engenharia', marginX, 7);
        pdf.text(`Código: ${verificationCode}`, pageWidth - marginX, 7, { align: 'right' });
      };

      const drawFooter = () => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let page = 1; page <= totalPages; page += 1) {
          pdf.setPage(page);
          pdf.setDrawColor(226, 232, 240);
          pdf.line(marginX, pageHeight - 15, pageWidth - marginX, pageHeight - 15);
          pdf.setFont('Helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(100, 116, 139);
          pdf.text(profileData.footer_text || 'Documento técnico elaborado pelo profissional identificado.', marginX, pageHeight - 10);
          pdf.text(`Página ${page} de ${totalPages}`, pageWidth - marginX, pageHeight - 10, { align: 'right' });
        }
      };

      const addSection = (title, content) => {
        const lines = toTextLines(content);
        if (!lines.length) return;

        checkPageBreak(18);
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text(title, marginX, y);
        y += 6;
        pdf.setFont('Helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);
        lines.forEach((line) => {
          const wrapped = pdf.splitTextToSize(line, pageWidth - (marginX * 2));
          wrapped.forEach((wrappedLine) => {
            checkPageBreak(6);
            pdf.text(wrappedLine, marginX, y);
            y += 5;
          });
          y += 2;
        });
      };

      drawHeader();

      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(15, 23, 42);
      pdf.text(documentData.title || getDocumentTemplate(documentData.type).title, marginX, y);
      y += 9;
      pdf.setFontSize(10);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Versão ${documentData.version || '1.0'} · ${getDocumentStatusLabel(documentData.status)} · Emitido em ${formatDate(new Date().toISOString())}`, marginX, y);
      y += 10;

      if (documentData.status === ENGINEERING_DOCUMENT_STATUS.draft) {
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(34);
        pdf.setTextColor(226, 232, 240);
        pdf.text('RASCUNHO', pageWidth / 2, 55, { align: 'center', angle: 0 });
      }

      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(203, 213, 225);
      pdf.roundedRect(marginX, y, pageWidth - (marginX * 2), 42, 2, 2, 'FD');
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Contratante', marginX + 4, y + 7);
      pdf.text('Responsável técnico', marginX + 96, y + 7);
      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(clientData.nome || 'Não informado', marginX + 4, y + 13);
      pdf.text(clientData.telefone || '', marginX + 4, y + 18);
      pdf.text(clientData.email || '', marginX + 4, y + 23);
      pdf.text(projectData.title || 'Projeto não vinculado', marginX + 4, y + 32);
      pdf.text(profileData.full_name || 'Não informado', marginX + 96, y + 13);
      pdf.text([profileData.profession, profileData.specialty].filter(Boolean).join(' · '), marginX + 96, y + 18);
      pdf.text(profileData.show_fields?.registration ? `${profileData.crea_number || ''} ${profileData.registration_state || ''}` : '', marginX + 96, y + 23);
      pdf.text(profileData.email || '', marginX + 96, y + 28);
      y += 52;

      addSection('Objeto', documentData.object);
      addSection('Finalidade', documentData.purpose);
      addSection('Solicitação recebida', documentData.request_received);
      addSection('Histórico', documentData.history);
      addSection('Metodologia utilizada', documentData.methodology);
      addSection('Vistoria', [
        documentData.inspection_date ? `Data: ${formatDate(documentData.inspection_date)}` : '',
        documentData.inspection_time ? `Horário: ${documentData.inspection_time}` : '',
        documentData.participants ? `Participantes: ${documentData.participants}` : '',
        documentData.conditions ? `Condições encontradas: ${documentData.conditions}` : '',
      ].filter(Boolean).join('\n'));
      addSection('Constatações', documentData.findings);
      addSection('Informações relatadas por terceiros', documentData.reported_information);
      addSection('Hipóteses técnicas que dependem de confirmação', documentData.hypothesis);
      addSection('Análise técnica', documentData.analysis);
      addSection('Recomendações', documentData.recommendations);
      addSection('Conclusão confirmada pelo profissional', documentData.confirmed_conclusion);
      addSection('Limitações da análise', documentData.limitations);

      if (budgetData.id) {
        addSection('Resumo do orçamento vinculado', [
          `Orçamento #${budgetData.numero ? String(budgetData.numero).padStart(4, '0') : budgetData.id}`,
          `Status: ${budgetData.status || 'Não informado'}`,
          `Total: ${currency.format(Number(budgetData.total || 0))}`,
        ].join('\n'));
      }

      if (documentData.art?.number || documentData.art?.not_applicable) {
        addSection('Informações da ART', documentData.art.not_applicable
          ? `ART marcada como não aplicável. Justificativa: ${documentData.art.justification || 'Não informada'}`
          : [
            `Número da ART informado pelo profissional: ${documentData.art.number || 'Não informado'}`,
            `Situação: ${documentData.art.status || 'Não informada'}`,
            documentData.art.consultation_url ? `Consulta: ${documentData.art.consultation_url}` : '',
            'Consulte a autenticidade nos canais oficiais do CREA.',
          ].filter(Boolean).join('\n'));
      }

      if (documentData.photos.length) {
        checkPageBreak(20);
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text('Registros fotográficos', marginX, y);
        y += 8;

        for (const photo of documentData.photos) {
          checkPageBreak(58);
          try {
            const imageData = await loadImageAsDataUrl(photo.url);
            pdf.addImage(imageData, 'JPEG', marginX, y, 58, 42, undefined, 'FAST');
          } catch {
            pdf.setFillColor(241, 245, 249);
            pdf.rect(marginX, y, 58, 42, 'F');
            pdf.setFontSize(8);
            pdf.setTextColor(100, 116, 139);
            pdf.text('Imagem indisponível no PDF', marginX + 4, y + 22);
          }
          pdf.setFont('Helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          pdf.text(`Foto ${String(photo.sequence || 1).padStart(2, '0')} — ${(photo.caption || 'Registro fotográfico').slice(0, 80)}`, marginX + 64, y + 5);
          pdf.setFont('Helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(71, 85, 105);
          const photoLines = [
            photo.environment ? `Ambiente: ${photo.environment}` : '',
            photo.observed_fact ? `Fato observado: ${photo.observed_fact}` : '',
            photo.reported_information ? `Informação relatada: ${photo.reported_information}` : '',
            photo.technical_hypothesis ? `Hipótese: ${photo.technical_hypothesis}` : '',
            photo.confirmed_conclusion ? `Conclusão confirmada: ${photo.confirmed_conclusion}` : '',
          ].filter(Boolean);
          photoLines.slice(0, 6).forEach((line, index) => {
            pdf.text(line.slice(0, 76), marginX + 64, y + 11 + (index * 5));
          });
          y += 49;
        }
      }

      addSection('Assinatura', [
        profileData.full_name || 'Responsável técnico não informado',
        profileData.show_fields?.registration ? `${profileData.crea_number || ''} ${profileData.registration_state || ''}` : '',
        'Documento técnico elaborado e aprovado pelo responsável identificado.',
      ].filter(Boolean).join('\n'));

      drawFooter();
      pdf.save(`${documentData.title || 'documento-tecnico'}-${verificationCode}.pdf`);
      toast.success('PDF técnico gerado.');
    } catch (error) {
      toast.error(`Erro ao gerar PDF: ${error.message || 'Tente novamente'}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const completionScore = getCompletionScore(documentDraft);
  const selectedTemplate = getDocumentTemplate(documentDraft.type);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-6">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">OrçaJá Engenharia</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">Central técnica</h1>
              <p className="mt-1 text-sm text-slate-400">Documentos, obras, vistorias, fotos, RDOs e orçamentos conectados.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => startDocument('vistoria')}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-400"
              >
                Nova vistoria
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-100 hover:bg-slate-800"
              >
                Perfil técnico
              </button>
            </div>
          </div>

          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {ENGINEERING_MODULE_TABS.map(tab => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${
                  activeTab === tab.value
                    ? 'bg-white text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        {loading && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
            Carregando módulo de engenharia...
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">O que você precisa emitir hoje?</h2>
                  <p className="text-sm text-slate-500">Atalhos grandes para uso em campo, no celular ou tablet.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ENGINEERING_ACTIONS.map(action => (
                  <button
                    key={action.type}
                    type="button"
                    onClick={() => startDocument(action.type)}
                    className={`min-h-24 rounded-lg border p-4 text-left transition ${getActionToneClass(action.tone)}`}
                  >
                    <p className="text-sm font-black">{action.label}</p>
                    <p className="mt-2 text-xs font-semibold opacity-75">Modelo estruturado com salvamento automático.</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase text-slate-500">Obras ativas</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{metrics.activeProjects}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <p className="text-xs font-bold uppercase text-amber-700">Aguardando revisão</p>
                <p className="mt-2 text-3xl font-black text-amber-950">{metrics.reviewDocuments}</p>
              </div>
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
                <p className="text-xs font-bold uppercase text-cyan-700">Documentos em rascunho</p>
                <p className="mt-2 text-3xl font-black text-cyan-950">{metrics.draftDocuments}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <p className="text-xs font-bold uppercase text-emerald-700">Valor aprovado</p>
                <p className="mt-2 text-2xl font-black text-emerald-950">{currency.format(metrics.approvedBudgetValue)}</p>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-black text-slate-900">Documentos recentes</h3>
                <div className="mt-4 space-y-3">
                  {documents.slice(0, 5).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">Nenhum documento técnico criado ainda.</p>
                  ) : documents.slice(0, 5).map(documentItem => (
                    <button
                      key={documentItem.id}
                      type="button"
                      onClick={() => editDocument(documentItem)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-black text-slate-900">{documentItem.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {clientsById[String(documentItem.cliente_id)]?.nome || 'Cliente não informado'} · versão {documentItem.version || '1.0'}
                          </p>
                        </div>
                        <span className={`w-fit rounded-full px-2 py-1 text-xs font-bold ${getDocumentStatusClass(documentItem.status)}`}>
                          {getDocumentStatusLabel(documentItem.status)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-black text-slate-900">Ações que pedem atenção</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3 font-semibold text-slate-700">
                    {metrics.pendingProposals} proposta(s) aguardando resposta.
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-800">
                    {metrics.pendingArt} ART(s) pendente(s) de conferência.
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 font-semibold text-red-800">
                    {metrics.openNonConformities} não conformidade(s) aberta(s).
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-800">
                    {metrics.deliveredThisMonth} documento(s) entregue(s) no mês.
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'projects' && (
          <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
            <form onSubmit={handleSaveProject} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">Nova obra ou projeto</h2>
              <div className="mt-4 space-y-3">
                <input value={projectForm.title} onChange={event => updateProjectField('title', event.target.value)} placeholder="Título da obra/projeto" className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={projectForm.internal_code} onChange={event => updateProjectField('internal_code', event.target.value)} placeholder="Código interno" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <select value={projectForm.cliente_id} onChange={event => updateProjectField('cliente_id', event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
                    <option value="">Cliente</option>
                    {clientes.map(cliente => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                  </select>
                </div>
                <input value={projectForm.property.address} onChange={event => updateProjectProperty('address', event.target.value)} placeholder="Endereço do imóvel/local vistoriado" className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={projectForm.property.municipal_registration} onChange={event => updateProjectProperty('municipal_registration', event.target.value)} placeholder="Inscrição imobiliária" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <input value={projectForm.property.declared_area} onChange={event => updateProjectProperty('declared_area', event.target.value)} placeholder="Área informada" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <input value={projectForm.property.owner} onChange={event => updateProjectProperty('owner', event.target.value)} placeholder="Proprietário" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <input value={projectForm.property.occupant} onChange={event => updateProjectProperty('occupant', event.target.value)} placeholder="Ocupante" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                </div>
                <textarea value={projectForm.property.characteristics} onChange={event => updateProjectProperty('characteristics', event.target.value)} rows={2} placeholder="Características principais do imóvel" className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={projectForm.responsible_technical} onChange={event => updateProjectField('responsible_technical', event.target.value)} placeholder="Responsável técnico" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <input value={projectForm.team} onChange={event => updateProjectField('team', event.target.value)} placeholder="Equipe" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <input type="date" value={projectForm.start_date} onChange={event => updateProjectField('start_date', event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <input type="date" value={projectForm.expected_end_date} onChange={event => updateProjectField('expected_end_date', event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <input value={projectForm.contract_number} onChange={event => updateProjectField('contract_number', event.target.value)} placeholder="Contrato" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <input value={projectForm.administrative_process} onChange={event => updateProjectField('administrative_process', event.target.value)} placeholder="Processo administrativo" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <input value={projectForm.service_order} onChange={event => updateProjectField('service_order', event.target.value)} placeholder="Ordem de serviço" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                  <input value={projectForm.art_number} onChange={event => updateProjectField('art_number', event.target.value)} placeholder="Número da ART" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                </div>
                <textarea value={projectForm.object_description} onChange={event => updateProjectField('object_description', event.target.value)} rows={3} placeholder="Descrição do objeto" className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <button disabled={savingProject} className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60">
                  {savingProject ? 'Salvando...' : 'Cadastrar obra/projeto'}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {projects.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Nenhuma obra ou projeto cadastrado.</div>
              ) : projects.map(project => (
                <article key={project.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-blue-700">{project.internal_code || 'Sem código'}</p>
                      <h3 className="mt-1 text-lg font-black text-slate-900">{project.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{clientsById[String(project.cliente_id)]?.nome || 'Cliente não informado'}</p>
                      <p className="mt-2 text-sm text-slate-600">{project.property?.address || 'Endereço não informado'}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{project.situation || 'ativo'}</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Contrato</p><p className="font-semibold text-slate-900">{project.contract_number || 'N/A'}</p></div>
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Processo</p><p className="font-semibold text-slate-900">{project.administrative_process || 'N/A'}</p></div>
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">ART</p><p className="font-semibold text-slate-900">{project.art_number || 'Pendente'}</p></div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'documents' && (
          <section className="space-y-5">
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Documentos técnicos</h2>
                <p className="text-sm text-slate-500">Crie do zero, duplique ou use dados de cliente, obra e orçamento.</p>
              </div>
              <button type="button" onClick={() => startDocument('relatorio_tecnico')} className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
                Novo documento
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {documents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 md:col-span-2 xl:col-span-3">Nenhum documento criado.</div>
              ) : documents.map(documentItem => (
                <article key={documentItem.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">{getDocumentTemplate(documentItem.type).title}</p>
                      <h3 className="mt-1 font-black text-slate-900">{documentItem.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{clientsById[String(documentItem.cliente_id)]?.nome || 'Cliente não informado'}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${getDocumentStatusClass(documentItem.status)}`}>{getDocumentStatusLabel(documentItem.status)}</span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Versão</p><p className="font-black">{documentItem.version || '1.0'}</p></div>
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Fotos</p><p className="font-black">{documentItem.photos?.length || 0}</p></div>
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Score</p><p className="font-black">{documentItem.completion_score || 0}%</p></div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => editDocument(documentItem)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800">Abrir</button>
                    <button type="button" onClick={() => startDocument(documentItem.type, documentItem)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Duplicar</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">Perfil técnico profissional</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <input value={profileForm.full_name} onChange={event => updateProfileField('full_name', event.target.value)} placeholder="Nome completo" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.profession} onChange={event => updateProfileField('profession', event.target.value)} placeholder="Profissão" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.specialty} onChange={event => updateProfileField('specialty', event.target.value)} placeholder="Especialidade" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.crea_number} onChange={event => updateProfileField('crea_number', event.target.value)} placeholder="CREA/CAU" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.registration_state} onChange={event => updateProfileField('registration_state', event.target.value)} placeholder="UF do registro" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.cpf_cnpj} onChange={event => updateProfileField('cpf_cnpj', event.target.value)} placeholder="CPF/CNPJ" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.company_name} onChange={event => updateProfileField('company_name', event.target.value)} placeholder="Escritório/empresa" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.position} onChange={event => updateProfileField('position', event.target.value)} placeholder="Cargo" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.municipal_department} onChange={event => updateProfileField('municipal_department', event.target.value)} placeholder="Departamento municipal" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.phone} onChange={event => updateProfileField('phone', event.target.value)} placeholder="Telefone" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.email} onChange={event => updateProfileField('email', event.target.value)} placeholder="E-mail" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <input value={profileForm.professional_address} onChange={event => updateProfileField('professional_address', event.target.value)} placeholder="Endereço profissional" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm" />
                <textarea value={profileForm.intro_text} onChange={event => updateProfileField('intro_text', event.target.value)} rows={3} placeholder="Texto padrão de apresentação" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm md:col-span-2" />
                <textarea value={profileForm.footer_text} onChange={event => updateProfileField('footer_text', event.target.value)} rows={3} placeholder="Rodapé padrão dos documentos" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm md:col-span-2" />
              </div>
              <button type="button" onClick={handleSaveProfile} disabled={savingProfile} className="mt-5 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
                {savingProfile ? 'Salvando...' : 'Salvar perfil técnico'}
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-black text-slate-900">Exibição nos documentos</h3>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  ['registration', 'CREA/CAU'],
                  ['cpf_cnpj', 'CPF/CNPJ'],
                  ['phone', 'Telefone'],
                  ['email', 'E-mail'],
                  ['address', 'Endereço'],
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700">
                    {label}
                    <input type="checkbox" checked={Boolean(profileForm.show_fields?.[field])} onChange={event => updateProfileVisibility(field, event.target.checked)} className="h-4 w-4" />
                  </label>
                ))}
              </div>
            </div>
          </section>
        )}

        {['agenda', 'templates', 'team', 'settings'].includes(activeTab) && (
          <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-black uppercase text-blue-700">{ENGINEERING_MODULE_TABS.find(tab => tab.value === activeTab)?.label}</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Estrutura preparada</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Esta área já está prevista na navegação para evoluir com agenda, modelos personalizados, equipe, permissões e configurações institucionais sem redesenhar o módulo.
            </p>
          </section>
        )}
      </main>

      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 sm:p-6">
          <div className="w-full max-w-5xl rounded-lg bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-blue-700">Assistente de documento</p>
                  <h2 className="text-xl font-black text-slate-950">{documentDraft.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">Salvamento local automático ativo. Salve no banco para manter histórico e versões.</p>
                </div>
                <button type="button" onClick={() => setWizardOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Fechar</button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-9">
                {DOCUMENT_WIZARD_STEPS.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setWizardStep(index)}
                    className={`rounded-lg px-2 py-2 text-xs font-bold ${wizardStep === index ? 'bg-slate-950 text-white' : index < wizardStep ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {index + 1}. {step.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Progresso</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{completionScore}%</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Versão</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{documentDraft.version}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Status</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{getDocumentStatusLabel(documentDraft.status)}</p>
                </div>
              </div>

              {wizardStep === 0 && (
                <div className="space-y-4">
                  <h3 className="font-black text-slate-900">Tipo de documento</h3>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {DOCUMENT_TEMPLATES.map(template => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setDocumentDraft(prev => normalizeDocumentDraft({
                          ...prev,
                          type: template.type,
                          title: template.title,
                          purpose: prev.purpose || template.defaultPurpose,
                          enabled_blocks: template.blocks,
                        }))}
                        className={`rounded-lg border p-4 text-left ${documentDraft.type === template.type ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                      >
                        <p className="font-black text-slate-900">{template.title}</p>
                        <p className="mt-2 text-sm text-slate-500">{template.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wizardStep === 1 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-bold text-slate-700">
                    Cliente
                    <select value={documentDraft.cliente_id} onChange={event => updateDocumentField('cliente_id', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <option value="">Selecione</option>
                      {clientes.map(cliente => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-bold text-slate-700">
                    Obra/projeto
                    <select value={documentDraft.project_id} onChange={event => updateDocumentField('project_id', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <option value="">Sem vínculo</option>
                      {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-bold text-slate-700">
                    Orçamento vinculado
                    <select value={documentDraft.orcamento_id} onChange={event => updateDocumentField('orcamento_id', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <option value="">Sem orçamento</option>
                      {orcamentos.map(orcamento => <option key={orcamento.id} value={orcamento.id}>#{orcamento.numero || orcamento.id.slice(0, 5)} · {currency.format(Number(orcamento.total || 0))}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-bold text-slate-700">
                    Título do documento
                    <input value={documentDraft.title} onChange={event => updateDocumentField('title', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" />
                  </label>
                  <label className="block text-sm font-bold text-slate-700 md:col-span-2">
                    Objeto
                    <textarea value={documentDraft.object} onChange={event => updateDocumentField('object', event.target.value)} rows={3} placeholder={FIELD_GUIDES.object} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" />
                  </label>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-bold text-slate-700">Data da vistoria<input type="date" value={documentDraft.inspection_date} onChange={event => updateDocumentField('inspection_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                  <label className="block text-sm font-bold text-slate-700">Horário<input type="time" value={documentDraft.inspection_time} onChange={event => updateDocumentField('inspection_time', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                  <label className="block text-sm font-bold text-slate-700 md:col-span-2">Participantes<input value={documentDraft.participants} onChange={event => updateDocumentField('participants', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                  <label className="block text-sm font-bold text-slate-700 md:col-span-2">Condições encontradas<textarea value={documentDraft.conditions} onChange={event => updateDocumentField('conditions', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                  <label className="block text-sm font-bold text-slate-700 md:col-span-2">Metodologia<textarea value={documentDraft.methodology} onChange={event => updateDocumentField('methodology', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-700">Constatações<textarea value={documentDraft.findings} onChange={event => updateDocumentField('findings', event.target.value)} rows={4} placeholder={FIELD_GUIDES.findings} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                  <label className="block text-sm font-bold text-slate-700">Informações relatadas<textarea value={documentDraft.reported_information} onChange={event => updateDocumentField('reported_information', event.target.value)} rows={3} placeholder={FIELD_GUIDES.reported_information} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                  <label className="block text-sm font-bold text-slate-700">Hipóteses técnicas<textarea value={documentDraft.hypothesis} onChange={event => updateDocumentField('hypothesis', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                    <p className="font-black text-slate-900">Fotografias e evidências</p>
                    <p className="mt-1 text-sm text-slate-500">As fotos são comprimidas e enviadas para Firebase Storage; o Firestore salva apenas metadados e URL.</p>
                    <label className="mt-4 inline-flex cursor-pointer rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
                      {uploadingPhotos ? 'Enviando...' : 'Adicionar fotos'}
                      <input type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoUpload} disabled={uploadingPhotos} className="hidden" />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {documentDraft.photos.map(photo => (
                      <div key={photo.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        {photo.url && <img src={photo.url} alt={photo.caption || 'Foto'} className="h-52 w-full rounded-lg object-cover" />}
                        <div className="mt-3 grid gap-2">
                          <input value={photo.caption || ''} onChange={event => updatePhoto(photo.id, 'caption', event.target.value)} placeholder="Legenda" className="rounded border border-slate-200 p-2 text-sm" />
                          <input value={photo.environment || ''} onChange={event => updatePhoto(photo.id, 'environment', event.target.value)} placeholder="Ambiente" className="rounded border border-slate-200 p-2 text-sm" />
                          <textarea value={photo.observed_fact || ''} onChange={event => updatePhoto(photo.id, 'observed_fact', event.target.value)} rows={2} placeholder="Fato observado" className="rounded border border-slate-200 p-2 text-sm" />
                          <textarea value={photo.reported_information || ''} onChange={event => updatePhoto(photo.id, 'reported_information', event.target.value)} rows={2} placeholder="Informação relatada por terceiro" className="rounded border border-slate-200 p-2 text-sm" />
                          <textarea value={photo.technical_hypothesis || ''} onChange={event => updatePhoto(photo.id, 'technical_hypothesis', event.target.value)} rows={2} placeholder="Hipótese técnica, se houver" className="rounded border border-slate-200 p-2 text-sm" />
                          <button type="button" onClick={() => removePhoto(photo.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100">Remover foto</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-700">Análise técnica<textarea value={documentDraft.analysis} onChange={event => updateDocumentField('analysis', event.target.value)} rows={5} placeholder={FIELD_GUIDES.analysis} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                  <label className="block text-sm font-bold text-slate-700">Conclusão confirmada<textarea value={documentDraft.confirmed_conclusion} onChange={event => updateDocumentField('confirmed_conclusion', event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                  <label className="block text-sm font-bold text-slate-700">Limitações<textarea value={documentDraft.limitations} onChange={event => updateDocumentField('limitations', event.target.value)} rows={3} placeholder={FIELD_GUIDES.limitations} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                </div>
              )}

              {wizardStep === 6 && (
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-700">Recomendações<textarea value={documentDraft.recommendations} onChange={event => updateDocumentField('recommendations', event.target.value)} rows={5} placeholder={FIELD_GUIDES.recommendations} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-bold text-slate-700">Prioridade<select value={documentDraft.priority} onChange={event => updateDocumentField('priority', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></label>
                    <label className="block text-sm font-bold text-slate-700">Próximos passos<input value={documentDraft.next_steps} onChange={event => updateDocumentField('next_steps', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
                  </div>
                </div>
              )}

              {wizardStep === 7 && (
                <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-4">
                    <h3 className="font-black text-slate-900">Blocos do documento</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {DOCUMENT_BLOCK_LIBRARY.map(block => (
                        <label key={block.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                          {block.label}
                          <input type="checkbox" checked={(documentDraft.enabled_blocks || []).includes(block.id)} disabled={block.required} onChange={() => toggleDocumentBlock(block.id)} className="h-4 w-4" />
                        </label>
                      ))}
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      Assistente Técnico OrçaJá: em breve. Toda geração por IA ficará como rascunho e exigirá revisão do profissional habilitado.
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-black text-slate-900">ART</h3>
                    <div className="mt-3 space-y-2">
                      <input value={documentDraft.art.number} onChange={event => updateDocumentArt('number', event.target.value)} placeholder="Número da ART" className="w-full rounded border border-slate-200 p-2 text-sm" />
                      <select value={documentDraft.art.status} onChange={event => updateDocumentArt('status', event.target.value)} className="w-full rounded border border-slate-200 p-2 text-sm"><option value="pendente">Pendente</option><option value="informada">Informada</option><option value="regular">Regular</option><option value="dispensada">Dispensada</option></select>
                      <input value={documentDraft.art.consultation_url} onChange={event => updateDocumentArt('consultation_url', event.target.value)} placeholder="Link de consulta oficial" className="w-full rounded border border-slate-200 p-2 text-sm" />
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={documentDraft.art.not_applicable} onChange={event => updateDocumentArt('not_applicable', event.target.checked)} /> Não aplicável</label>
                      {documentDraft.art.not_applicable && <textarea value={documentDraft.art.justification} onChange={event => updateDocumentArt('justification', event.target.value)} rows={3} placeholder="Justificativa" className="w-full rounded border border-slate-200 p-2 text-sm" />}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 8 && (
                <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-black uppercase text-blue-700">Prévia estrutural</p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">{documentDraft.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{selectedTemplate.description}</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      <p><strong>Cliente:</strong> {selectedClient?.nome || 'Não informado'}</p>
                      <p><strong>Projeto:</strong> {selectedProject?.title || 'Sem vínculo'}</p>
                      <p><strong>Orçamento:</strong> {selectedBudget ? currency.format(Number(selectedBudget.total || 0)) : 'Sem vínculo'}</p>
                      <p><strong>Fotos:</strong> {documentDraft.photos.length}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <button type="button" onClick={() => handleSaveDocument()} disabled={savingDocument} className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60">{savingDocument ? 'Salvando...' : 'Salvar rascunho'}</button>
                    <button type="button" onClick={() => handleSaveDocument(ENGINEERING_DOCUMENT_STATUS.review)} disabled={savingDocument} className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-60">Enviar para revisão</button>
                    <button type="button" onClick={() => generateDocumentPdf(documentDraft)} disabled={generatingPdf} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">{generatingPdf ? 'Gerando...' : 'Gerar PDF'}</button>
                    <select value={documentDraft.status} onChange={event => updateDocumentField('status', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm font-bold">
                      {ENGINEERING_DOCUMENT_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => setWizardStep(Math.max(0, wizardStep - 1))} disabled={wizardStep === 0} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Voltar</button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => handleSaveDocument()} disabled={savingDocument} className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60">Salvar</button>
                <button type="button" onClick={() => setWizardStep(Math.min(DOCUMENT_WIZARD_STEPS.length - 1, wizardStep + 1))} disabled={wizardStep === DOCUMENT_WIZARD_STEPS.length - 1} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">Próximo</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
