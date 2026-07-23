import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  ORCAMENTO_STATUS,
  getOrcamentoStatusClass,
  getOrcamentoStatusLabel,
  normalizeOrcamentoStatus,
} from '../orcamentoStatus';
import {
  DEFAULT_ACCENT_COLOR,
  buildPaymentDescription,
  normalizePaymentDetails,
  sanitizeHexColor,
} from '../publicOrcamento';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const formatDate = (value) => {
  if (!value) return 'Nao informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nao informado';
  return date.toLocaleDateString('pt-BR');
};

const isPublicOrcamentoExpired = (orcamento) => {
  if (!orcamento?.valid_until) return false;
  const validUntil = new Date(orcamento.valid_until);
  if (Number.isNaN(validUntil.getTime())) return false;
  return validUntil.getTime() < Date.now();
};

const getLineTotal = (item, quantityKey, priceKey) => {
  return Number(item?.[quantityKey] || 0) * Number(item?.[priceKey] || 0);
};

export default function PublicOrcamentoPage() {
  const { token } = useParams();
  const [orcamento, setOrcamento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingStatus, setSubmittingStatus] = useState('');
  const [acceptanceName, setAcceptanceName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const publicRef = useMemo(() => {
    return token ? doc(db, 'public_orcamentos', token) : null;
  }, [token]);

  useEffect(() => {
    const loadPublicOrcamento = async () => {
      if (!publicRef) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(publicRef);
        if (!snapshot.exists()) {
          setOrcamento(null);
          return;
        }

        const data = { id: snapshot.id, ...snapshot.data(), loaded_at: Date.now() };
        setOrcamento(data);

        if (normalizeOrcamentoStatus(data.status) === ORCAMENTO_STATUS.sent) {
          const now = new Date().toISOString();
          await updateDoc(publicRef, {
            status: ORCAMENTO_STATUS.viewed,
            viewed_at: now,
            updated_at: now,
          });
          setOrcamento(prev => prev ? {
            ...prev,
            status: ORCAMENTO_STATUS.viewed,
            viewed_at: now,
            updated_at: now,
          } : prev);
        }
      } catch (error) {
        console.error('Erro ao carregar proposta publica:', error);
        toast.error('Nao foi possivel carregar esta proposta.');
      } finally {
        setLoading(false);
      }
    };

    loadPublicOrcamento();
  }, [publicRef]);

  const respondToOrcamento = async (status) => {
    if (!publicRef || !orcamento) return;

    const normalizedStatus = normalizeOrcamentoStatus(orcamento.status);
    if (![ORCAMENTO_STATUS.sent, ORCAMENTO_STATUS.viewed].includes(normalizedStatus)) {
      toast.error('Esta proposta nao pode receber uma nova resposta.');
      return;
    }

    if (status === ORCAMENTO_STATUS.approved) {
      if (isPublicOrcamentoExpired(orcamento)) {
        toast.error('Esta proposta venceu. Peça um novo envio antes de aprovar.');
        return;
      }

      if (acceptanceName.trim().length < 3) {
        toast.error('Digite seu nome para aprovar a proposta.');
        return;
      }

      if (!acceptedTerms) {
        toast.error('Confirme o aceite das condicoes da proposta.');
        return;
      }
    }

    setSubmittingStatus(status);
    try {
      const now = new Date().toISOString();
      const updates = {
        status,
        responded_at: now,
        updated_at: now,
      };

      if (status === ORCAMENTO_STATUS.approved) {
        updates.client_acceptance = {
          name: acceptanceName.trim(),
          accepted_terms: true,
          accepted_at: now,
        };
      }

      await updateDoc(publicRef, updates);
      setOrcamento(prev => ({
        ...prev,
        ...updates,
      }));
      toast.success(status === ORCAMENTO_STATUS.approved
        ? 'Proposta aprovada com sucesso.'
        : 'Resposta enviada com sucesso.');
    } catch (error) {
      console.error('Erro ao responder proposta:', error);
      toast.error('Nao foi possivel enviar sua resposta.');
    } finally {
      setSubmittingStatus('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-700">
        Carregando proposta...
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-bold uppercase text-slate-500">Proposta indisponivel</p>
          <h1 className="mt-2 text-xl font-black text-slate-900">Nao encontramos este orcamento</h1>
          <p className="mt-3 text-sm text-slate-500">
            Confira se o link esta correto ou peca um novo envio para quem preparou a proposta.
          </p>
        </div>
      </div>
    );
  }

  const accentColor = sanitizeHexColor(orcamento.company?.accent_color, DEFAULT_ACCENT_COLOR);
  const status = normalizeOrcamentoStatus(orcamento.status);
  const canRespond = [ORCAMENTO_STATUS.sent, ORCAMENTO_STATUS.viewed].includes(status);
  const alreadyResponded = [ORCAMENTO_STATUS.approved, ORCAMENTO_STATUS.rejected, ORCAMENTO_STATUS.completed].includes(status);
  const validUntil = orcamento.valid_until ? new Date(orcamento.valid_until) : null;
  const expired = validUntil && orcamento.loaded_at && validUntil.getTime() < orcamento.loaded_at;
  const company = orcamento.company || {};
  const cliente = orcamento.cliente || {};
  const terms = String(company.terms || '').split('\n').map(line => line.trim()).filter(Boolean);
  const payment = normalizePaymentDetails(orcamento.payment || {});
  const paymentDescription = orcamento.payment_description || buildPaymentDescription(payment, Number(orcamento.total || 0), value => currency.format(value));
  const acceptance = orcamento.client_acceptance || {};
  const technical = orcamento.technical || {};

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: accentColor }}>
              Proposta digital
            </p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              {company.name || 'Orcamento profissional'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Orcamento #{orcamento.numero ? String(orcamento.numero).padStart(4, '0') : orcamento.orcamento_id?.slice(0, 6)}
            </p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${getOrcamentoStatusClass(status)}`}>
            {getOrcamentoStatusLabel(status)}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Cliente</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{cliente.nome || 'Cliente'}</h2>
              <p className="mt-3 text-sm text-slate-500">
                Validade: {formatDate(orcamento.valid_until)}
              </p>
            </div>
            <div className="rounded-lg p-4 text-white" style={{ backgroundColor: accentColor }}>
              <p className="text-xs font-bold uppercase opacity-80">Total da proposta</p>
              <p className="mt-2 text-3xl font-black">{currency.format(Number(orcamento.total || 0))}</p>
              <p className="mt-2 text-xs opacity-80">
                Materiais e servicos organizados para decisao rapida.
              </p>
              {technical.enabled && Number(orcamento.bdi_total || 0) > 0 && (
                <p className="mt-2 text-sm font-bold opacity-90">
                  BDI: {currency.format(Number(orcamento.bdi_total || 0))}
                </p>
              )}
            </div>
          </div>
        </section>

        {expired && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            Esta proposta passou da data de validade. Confirme os valores antes de aprovar.
          </div>
        )}

        {technical.enabled && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Dados técnicos</h3>
            <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Objeto</p>
                <p className="mt-1 font-semibold text-slate-900">{technical.object || 'Nao informado'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Local</p>
                <p className="mt-1 font-semibold text-slate-900">{technical.location || 'Nao informado'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Fonte</p>
                <p className="mt-1 font-semibold text-slate-900">{[technical.reference_source, technical.reference_uf].filter(Boolean).join('/') || 'Nao informada'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Responsavel</p>
                <p className="mt-1 font-semibold text-slate-900">{[technical.responsible_name, technical.professional_registry].filter(Boolean).join(' · ') || 'Nao informado'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Data-base</p>
                <p className="mt-1 font-semibold text-slate-900">{technical.date_base ? formatDate(technical.date_base) : 'Nao informada'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">BDI global</p>
                <p className="mt-1 font-semibold text-slate-900">{Number(technical.global_bdi || 0).toFixed(2).replace('.', ',')}%</p>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Materiais</h3>
            <div className="mt-4 space-y-3">
              {(orcamento.itens || []).length === 0 ? (
                <p className="text-sm text-slate-500">Sem materiais informados.</p>
              ) : (orcamento.itens || []).map((item, index) => (
                <div key={`${item.nome}-${index}`} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-slate-900">{item.nome}</p>
                    <p className="mt-1 text-xs text-slate-500">{Number(item.qtd || 0)} {item.unidade || 'un'} x {currency.format(Number(item.precoVenda || 0))}</p>
                    {technical.enabled && (item.fonte || item.codigo || item.memoria_calculo) && (
                      <p className="mt-1 text-xs font-semibold text-blue-700">
                        {[item.fonte, item.codigo && `Codigo ${item.codigo}`, item.memoria_calculo].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <p className="font-black text-slate-900">{currency.format(getLineTotal(item, 'qtd', 'precoVenda'))}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Servicos</h3>
            <div className="mt-4 space-y-3">
              {(orcamento.servicos || []).length === 0 ? (
                <p className="text-sm text-slate-500">Sem servicos informados.</p>
              ) : (orcamento.servicos || []).map((item, index) => (
                <div key={`${item.descricao}-${index}`} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-slate-900">{item.descricao}</p>
                    <p className="mt-1 text-xs text-slate-500">{Number(item.horas || 0)} {item.unidade || 'h'} x {currency.format(Number(item.valorHora || 0))}</p>
                    {technical.enabled && (item.fonte || item.codigo || item.memoria_calculo) && (
                      <p className="mt-1 text-xs font-semibold text-blue-700">
                        {[item.fonte, item.codigo && `Codigo ${item.codigo}`, item.memoria_calculo].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <p className="font-black text-slate-900">{currency.format(getLineTotal(item, 'horas', 'valorHora'))}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {technical.enabled && (
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <h3 className="text-lg font-black text-blue-950">Resumo técnico</h3>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Subtotal</p>
                <p className="mt-1 text-lg font-black text-slate-900">{currency.format(Number(orcamento.subtotal || 0))}</p>
              </div>
              <div className="rounded-lg bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">BDI</p>
                <p className="mt-1 text-lg font-black text-slate-900">{currency.format(Number(orcamento.bdi_total || 0))}</p>
              </div>
              <div className="rounded-lg bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Total</p>
                <p className="mt-1 text-lg font-black text-blue-950">{currency.format(Number(orcamento.total || 0))}</p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Condicoes</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {terms.length ? terms.map(term => <li key={term}>{term}</li>) : (
              <li>Converse com o prestador para confirmar forma de pagamento e agenda.</li>
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Pagamento</h3>
          <p className="mt-3 text-sm font-semibold text-slate-700">{paymentDescription}</p>
          {payment.notes && (
            <p className="mt-2 text-sm text-slate-500">{payment.notes}</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {!canRespond ? 'Resposta registrada' : 'Tudo certo com esta proposta?'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {!canRespond
                  ? `Status atual: ${getOrcamentoStatusLabel(status)}.`
                  : 'Sua resposta fica registrada automaticamente para quem enviou o orcamento.'}
              </p>
              {canRespond ? (
                <div className="mt-4 space-y-3">
                  <input
                    value={acceptanceName}
                    onChange={event => setAcceptanceName(event.target.value)}
                    placeholder="Seu nome completo para aprovação"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="flex items-start gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={event => setAcceptedTerms(event.target.checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <span>Li e aceito as condições desta proposta.</span>
                  </label>
                </div>
              ) : acceptance.name ? (
                <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  Aceite registrado por {acceptance.name} em {formatDate(acceptance.accepted_at)}.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => respondToOrcamento(ORCAMENTO_STATUS.rejected)}
                disabled={!canRespond || alreadyResponded || submittingStatus !== ''}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingStatus === ORCAMENTO_STATUS.rejected ? 'Enviando...' : 'Recusar'}
              </button>
              <button
                type="button"
                onClick={() => respondToOrcamento(ORCAMENTO_STATUS.approved)}
                disabled={!canRespond || alreadyResponded || expired || submittingStatus !== ''}
                className="rounded-lg px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: accentColor }}
              >
                {submittingStatus === ORCAMENTO_STATUS.approved ? 'Enviando...' : 'Aprovar'}
              </button>
            </div>
          </div>
        </section>

        <footer className="pb-6 text-center text-xs text-slate-400">
          {company.phone || company.email ? (
            <span>{[company.phone, company.email].filter(Boolean).join(' · ')}</span>
          ) : (
            <span>Proposta enviada pelo OrcaJa.</span>
          )}
        </footer>
      </main>
    </div>
  );
}
