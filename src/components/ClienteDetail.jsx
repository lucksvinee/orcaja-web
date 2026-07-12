import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClientes } from '../useClientes';
import { useOrcamentos } from '../useOrcamentos';
import { getOrcamentoStatusClass, getOrcamentoStatusLabel } from '../orcamentoStatus';

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const clienteId = id;
  const { getClienteById } = useClientes();
  const { orcamentos, removeOrcamento } = useOrcamentos();

  const cliente = useMemo(() => {
    return getClienteById(clienteId);
  }, [clienteId, getClienteById]);

  const clienteOrcamentos = useMemo(() => {
    return orcamentos.filter(o => String(o.cliente_id) === String(clienteId));
  }, [orcamentos, clienteId]);

  const handleDeleteOrcamento = async (orcamentoId) => {
    if (window.confirm('Tem certeza que deseja remover este orçamento?')) {
      try {
        await removeOrcamento(orcamentoId);
        alert('Orçamento removido com sucesso!');
      } catch (error) {
        console.error('Erro ao remover orçamento:', error);
        alert('Erro ao remover orçamento: ' + error.message);
      }
    }
  };

  if (!cliente) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  const totalGeral = clienteOrcamentos.reduce((acc, o) => acc + (o.total || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{cliente.nome}</h1>
            <p className="text-xs text-slate-300">Detalhes e histórico</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/orcamento/novo/${clienteId}`)}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold transition"
            >
              ➕ Novo Orçamento
            </button>
            <button
              onClick={() => navigate('/clientes')}
              className="rounded-lg border border-slate-400 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm transition"
            >
              ← Voltar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* INFORMAÇÕES DO CLIENTE */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📋 Informações</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cliente.telefone && (
              <div>
                <p className="text-xs text-slate-500 font-semibold">Telefone</p>
                <a href={`tel:${cliente.telefone}`} className="text-blue-600 hover:underline font-semibold mt-1">
                  {cliente.telefone}
                </a>
              </div>
            )}
            {cliente.email && (
              <div>
                <p className="text-xs text-slate-500 font-semibold">Email</p>
                <a href={`mailto:${cliente.email}`} className="text-blue-600 hover:underline font-semibold mt-1 truncate">
                  {cliente.email}
                </a>
              </div>
            )}
            {cliente.endereco && (
              <div>
                <p className="text-xs text-slate-500 font-semibold">Endereço</p>
                <p className="font-semibold mt-1">{cliente.endereco}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 font-semibold">Cliente desde</p>
              <p className="font-semibold mt-1">{new Date(cliente.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* RESUMO */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <p className="text-xs text-blue-700 font-semibold uppercase">Orçamentos</p>
            <p className="text-3xl font-black text-blue-900 mt-2">{clienteOrcamentos.length}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
            <p className="text-xs text-emerald-700 font-semibold uppercase">Valor Total</p>
            <p className="text-3xl font-black text-emerald-900 mt-2">
              R$ {totalGeral.toFixed(2).replace('.', ',')}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-700 font-semibold uppercase">Ticket Médio</p>
            <p className="text-3xl font-black text-slate-900 mt-2">
              {clienteOrcamentos.length > 0
                ? 'R$ ' + (totalGeral / clienteOrcamentos.length).toFixed(2).replace('.', ',')
                : '---'}
            </p>
          </div>
        </div>

        {/* HISTÓRICO DE ORÇAMENTOS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">📊 Histórico de Orçamentos ({clienteOrcamentos.length})</h2>
          </div>

          {clienteOrcamentos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
              <p className="text-slate-500">Nenhum orçamento criado para este cliente ainda.</p>
              <p className="text-sm text-slate-400 mt-1">Clique no botão "Novo Orçamento" para começar!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clienteOrcamentos
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map((orcamento) => {
                  const qtdMateriais = (orcamento.itens || []).reduce((acc, m) => acc + m.qtd, 0);
                  const qtdServicos = (orcamento.servicos || []).length;

                  return (
                    <div key={orcamento.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900">Orçamento #{orcamento.numero ? String(orcamento.numero).padStart(4, '0') : orcamento.id.substring(0,5)}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getOrcamentoStatusClass(orcamento.status)}`}>
                              {getOrcamentoStatusLabel(orcamento.status)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            Criado em {new Date(orcamento.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-900">
                            R$ {(orcamento.total || 0).toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-slate-600">
                            🛒 {qtdMateriais} {qtdMateriais === 1 ? 'item' : 'itens'}
                          </span>
                          <span className="flex items-center gap-1 text-slate-600">
                            👷 {qtdServicos} {qtdServicos === 1 ? 'serviço' : 'serviços'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/orcamento/editar/${orcamento.id}`)}
                            className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1 text-slate-700 text-xs font-semibold transition"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleDeleteOrcamento(orcamento.id)}
                            className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1 text-red-700 text-xs font-semibold transition"
                          >
                            🗑️ Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
