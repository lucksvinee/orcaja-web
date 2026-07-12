import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import logo from '../assets/scarface-logo.png';
import { auth } from '../firebase';
import { useOrcamentos } from '../useOrcamentos';
import { useClientes } from '../useClientes';
import PasswordSecurityModal from './PasswordSecurityModal';
import { buildClientesCsvRows, buildOrcamentosCsvRows, downloadCsv } from '../exportUtils';
import {
  ORCAMENTO_STATUS,
  ORCAMENTO_STATUS_OPTIONS,
  getOrcamentoStatusClass,
  getOrcamentoStatusLabel,
  normalizeOrcamentoStatus
} from '../orcamentoStatus';

const statusOptions = [
  { value: 'todos', label: 'Todos' },
  ...ORCAMENTO_STATUS_OPTIONS,
];

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const normalizePhone = (phone = '') => phone.replace(/\D/g, '');

export default function Dashboard() {
  const navigate = useNavigate();
  const { orcamentos, updateOrcamento } = useOrcamentos();
  const { clientes } = useClientes();
  const [statusFilter, setStatusFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const viewedReminderShownRef = useRef(false);
  const userEmail = auth.currentUser?.email?.split('@')[0] || 'Usuário';

  const clientesById = useMemo(() => {
    return clientes.reduce((acc, cliente) => {
      acc[String(cliente.id)] = cliente;
      return acc;
    }, {});
  }, [clientes]);

  const enrichedOrcamentos = useMemo(() => {
    return orcamentos.map((orcamento) => ({
      ...orcamento,
      cliente: clientesById[String(orcamento.cliente_id)] || null,
    }));
  }, [orcamentos, clientesById]);

  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const approved = orcamentos.filter(o => [
      ORCAMENTO_STATUS.approved,
      ORCAMENTO_STATUS.completed
    ].includes(normalizeOrcamentoStatus(o.status)));
    const decided = orcamentos.filter(o => [
      ORCAMENTO_STATUS.approved,
      ORCAMENTO_STATUS.rejected,
      ORCAMENTO_STATUS.completed
    ].includes(normalizeOrcamentoStatus(o.status)));
    const pending = orcamentos.filter(o => [
      ORCAMENTO_STATUS.draft,
      ORCAMENTO_STATUS.sent,
      ORCAMENTO_STATUS.viewed
    ].includes(normalizeOrcamentoStatus(o.status)));
    const monthApproved = approved.filter((o) => {
      const createdAt = new Date(o.created_at);
      return createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
    });

    return {
      approvedRevenue: approved.reduce((acc, curr) => acc + (curr.total || 0), 0),
      monthRevenue: monthApproved.reduce((acc, curr) => acc + (curr.total || 0), 0),
      pendingValue: pending.reduce((acc, curr) => acc + (curr.total || 0), 0),
      conversionRate: decided.length ? Math.round((approved.length / decided.length) * 100) : 0,
      pendingCount: pending.length,
      viewedCount: orcamentos.filter(o => normalizeOrcamentoStatus(o.status) === ORCAMENTO_STATUS.viewed).length,
      clientCount: clientes.length,
    };
  }, [orcamentos, clientes]);

  const filteredOrcamentos = enrichedOrcamentos
    .filter((orcamento) => statusFilter === 'todos' || normalizeOrcamentoStatus(orcamento.status) === statusFilter)
    .filter((orcamento) => {
      const haystack = [
        orcamento.cliente?.nome,
        orcamento.cliente?.telefone,
        orcamento.status,
        orcamento.numero,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const viewedPendingOrcamentos = useMemo(() => {
    return enrichedOrcamentos.filter(orcamento => normalizeOrcamentoStatus(orcamento.status) === ORCAMENTO_STATUS.viewed);
  }, [enrichedOrcamentos]);

  useEffect(() => {
    if (viewedPendingOrcamentos.length > 0 && !viewedReminderShownRef.current) {
      viewedReminderShownRef.current = true;
      toast(`Você tem ${viewedPendingOrcamentos.length} proposta${viewedPendingOrcamentos.length > 1 ? 's' : ''} visualizada${viewedPendingOrcamentos.length > 1 ? 's' : ''} aguardando resposta.`);
    }
  }, [viewedPendingOrcamentos.length]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const updateOrcamentoStatus = async (id, novoStatus) => {
    try {
      await updateOrcamento(id, { status: novoStatus, updated_at: new Date().toISOString() });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do orçamento.');
    }
  };

  const sendReminder = (orcamento, event) => {
    event.stopPropagation();
    const phone = normalizePhone(orcamento.cliente?.telefone);
    if (!phone) {
      toast.error('Cadastre um telefone para enviar pelo WhatsApp.');
      return;
    }

    const isViewed = normalizeOrcamentoStatus(orcamento.status) === ORCAMENTO_STATUS.viewed;
    const message = [
      `Olá, ${orcamento.cliente?.nome || 'tudo bem'}!`,
      isViewed
        ? `Vi que você abriu o orçamento #${orcamento.numero ? String(orcamento.numero).padStart(4, '0') : orcamento.id.substring(0, 5)}.`
        : `Passando para confirmar se você recebeu o orçamento #${orcamento.numero ? String(orcamento.numero).padStart(4, '0') : orcamento.id.substring(0, 5)}.`,
      `Valor total: ${currency.format(orcamento.total || 0)}.`,
      'Posso tirar alguma dúvida para seguirmos?'
    ].join('\n');

    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    toast.success('WhatsApp aberto para envio.');

    if (normalizeOrcamentoStatus(orcamento.status) === ORCAMENTO_STATUS.draft) {
      updateOrcamentoStatus(orcamento.id, ORCAMENTO_STATUS.sent);
    }
  };

  const copyPublicLink = async (orcamento, event) => {
    event.stopPropagation();
    if (!orcamento.public_url) {
      toast.error('Gere o link dentro do orçamento primeiro.');
      return;
    }

    try {
      await navigator.clipboard.writeText(orcamento.public_url);
      toast.success('Link de aprovação copiado.');
    } catch {
      window.open(orcamento.public_url, '_blank', 'noopener,noreferrer');
      toast.success('Link aberto em nova aba.');
    }
  };

  const exportClientes = () => {
    downloadCsv('orcaja-clientes.csv', buildClientesCsvRows(clientes));
    toast.success('Clientes exportados em CSV.');
  };

  const exportOrcamentos = () => {
    downloadCsv('orcaja-orcamentos.csv', buildOrcamentosCsvRows(enrichedOrcamentos));
    toast.success('Orçamentos exportados em CSV.');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-950 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Scarface Solutions" className="h-12 w-12 rounded-xl border border-white/15 bg-white/10 p-1.5" />
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">OrcaJá</p>
                <h1 className="text-2xl font-black tracking-tight">Pipeline de orçamentos</h1>
                <p className="text-sm text-slate-400">Olá, {userEmail}. Veja o que precisa de ação hoje.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/clientes')}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Clientes
              </button>
              <button
                type="button"
                onClick={() => navigate('/orcamento/novo')}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-950/30 hover:bg-blue-700"
              >
                Novo orçamento
              </button>
              <button
                type="button"
                onClick={exportOrcamentos}
                disabled={!orcamentos.length}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
              >
                Exportar orçamentos
              </button>
              <button
                type="button"
                onClick={exportClientes}
                disabled={!clientes.length}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
              >
                Exportar clientes
              </button>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Senha
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900 hover:text-red-300"
              >
                Sair
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aprovado no mês</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">{currency.format(metrics.monthRevenue)}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Em aberto</p>
              <p className="mt-2 text-2xl font-black text-amber-300">{currency.format(metrics.pendingValue)}</p>
              <p className="mt-1 text-xs text-slate-500">{metrics.pendingCount} aguardando resposta</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Conversão</p>
              <p className="mt-2 text-2xl font-black text-blue-300">{metrics.conversionRate}%</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Base de clientes</p>
              <p className="mt-2 text-2xl font-black text-white">{metrics.clientCount}</p>
              <p className="mt-1 text-xs text-slate-500">Histórico e recorrência</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      statusFilter === option.value
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Buscar cliente, telefone ou número..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 lg:max-w-sm"
              />
            </div>

            <div className="space-y-3">
              {filteredOrcamentos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="font-bold text-slate-800">Nenhum orçamento neste filtro</p>
                  <p className="mt-1 text-sm text-slate-500">Crie um novo orçamento ou ajuste a busca para encontrar oportunidades.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/orcamento/novo')}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Criar orçamento
                  </button>
                </div>
              ) : filteredOrcamentos.map((orcamento) => (
                <article
                  key={orcamento.id}
                  onClick={() => navigate(`/orcamento/editar/${orcamento.id}`)}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md cursor-pointer"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-slate-900">{orcamento.cliente?.nome || 'Cliente removido'}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getOrcamentoStatusClass(orcamento.status)}`}>
                          {getOrcamentoStatusLabel(orcamento.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        #{orcamento.numero ? String(orcamento.numero).padStart(4, '0') : orcamento.id.substring(0, 5)} · {new Date(orcamento.created_at).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {(orcamento.itens || []).length} materiais · {(orcamento.servicos || []).length} serviços
                      </p>
                      {normalizeOrcamentoStatus(orcamento.status) === ORCAMENTO_STATUS.viewed && (
                        <p className="mt-1 text-xs font-semibold text-cyan-700">
                          Cliente visualizou a proposta. Vale fazer um lembrete.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 md:items-end">
                      <p className="text-2xl font-black text-slate-950">{currency.format(orcamento.total || 0)}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => sendReminder(orcamento, event)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          WhatsApp
                        </button>
                        {orcamento.public_url && (
                          <button
                            type="button"
                            onClick={(event) => copyPublicLink(orcamento, event)}
                            className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100"
                          >
                            Link
                          </button>
                        )}
                        <select
                          value={normalizeOrcamentoStatus(orcamento.status)}
                          onChange={(event) => updateOrcamentoStatus(orcamento.id, event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                        >
                          {ORCAMENTO_STATUS_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-bold text-slate-900">Próximas ações</h2>
              <div className="mt-4 space-y-3 text-sm">
                {metrics.viewedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter(ORCAMENTO_STATUS.viewed)}
                    className="w-full rounded-lg bg-cyan-50 p-3 text-left font-semibold text-cyan-800 hover:bg-cyan-100"
                  >
                    {metrics.viewedCount} proposta{metrics.viewedCount > 1 ? 's' : ''} visualizada{metrics.viewedCount > 1 ? 's' : ''} sem resposta
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStatusFilter(ORCAMENTO_STATUS.sent)}
                  className="w-full rounded-lg bg-amber-50 p-3 text-left font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Cobrar resposta dos enviados
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/clientes')}
                  className="w-full rounded-lg bg-blue-50 p-3 text-left font-semibold text-blue-800 hover:bg-blue-100"
                >
                  Reativar clientes antigos
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/orcamento/novo')}
                  className="w-full rounded-lg bg-slate-100 p-3 text-left font-semibold text-slate-800 hover:bg-slate-200"
                >
                  Criar proposta em menos de 2 minutos
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-bold text-slate-900">Resumo geral</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Receita aprovada</dt>
                  <dd className="font-bold text-slate-900">{currency.format(metrics.approvedRevenue)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Orçamentos totais</dt>
                  <dd className="font-bold text-slate-900">{orcamentos.length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Ticket médio</dt>
                  <dd className="font-bold text-slate-900">
                    {orcamentos.length ? currency.format(orcamentos.reduce((acc, item) => acc + (item.total || 0), 0) / orcamentos.length) : currency.format(0)}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </section>
      </main>

      {showPasswordModal && (
        <PasswordSecurityModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}
