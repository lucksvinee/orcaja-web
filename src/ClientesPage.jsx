import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes } from './useClientes';
import { z } from 'zod';

const ClienteSchema = z.object({
  nome: z.string().min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' }),
  email: z.string().email({ message: 'Formato de email inválido.' }).optional().or(z.literal('')),
  telefone: z.string().min(10, { message: 'O telefone deve ter pelo menos 10 dígitos.' }),
  endereco: z.string().optional(),
});

const normalizePhone = (phone = '') => phone.replace(/\D/g, '');

const openWhatsApp = (cliente) => {
  const phone = normalizePhone(cliente.telefone);
  if (!phone) {
    alert('Cadastre um telefone para chamar este cliente no WhatsApp.');
    return;
  }

  const message = `Olá, ${cliente.nome}! Tudo bem? Posso te ajudar com um orçamento?`;
  window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
};

export default function ClientesPage() {
  const navigate = useNavigate();
  const { clientes, addCliente, removeCliente } = useClientes();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    nome: '',
    email: '',
    telefone: '',
    endereco: '',
  });

  const [formErrors, setFormErrors] = useState({});

  const handleAddCliente = async () => {
    const result = ClienteSchema.safeParse(novoCliente);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFormErrors(errors);
      return;
    }

    try {
      await addCliente(novoCliente);
      setNovoCliente({ nome: '', email: '', telefone: '', endereco: '' });
      setShowModal(false);
      setFormErrors({});
      alert('Cliente adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
      alert('Erro ao adicionar cliente: ' + (error.message || 'Tente novamente'));
      setFormErrors({ submit: [error.message || 'Erro ao adicionar cliente'] });
    }
  };

  const handleRemoveCliente = (id) => {
    if (confirm('Tem certeza que deseja remover este cliente?')) {
      removeCliente(id);
    }
  };

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefone.includes(searchTerm) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-slate-800 transition text-slate-300 hover:text-white"
              title="Voltar para a página inicial"
            >
              ⬅️
            </button>
            <div>
              <h1 className="text-lg font-bold">Meus Clientes</h1>
              <p className="text-xs text-slate-300">{clientes.length} clientes cadastrados</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold transition"
            >
              Novo Cliente
            </button>
            <button
              onClick={() => navigate('/orcamento/novo')}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold transition"
            >
              Novo Orçamento
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* FILTRO */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
          <div className="mb-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs font-bold uppercase text-blue-700">Clientes</p>
              <p className="text-2xl font-black text-blue-950">{clientes.length}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-xs font-bold uppercase text-emerald-700">Com WhatsApp</p>
              <p className="text-2xl font-black text-emerald-950">{clientes.filter(cliente => normalizePhone(cliente.telefone).length >= 10).length}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs font-bold uppercase text-slate-600">Busca atual</p>
              <p className="text-2xl font-black text-slate-950">{filteredClientes.length}</p>
            </div>
          </div>
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            type="search"
            placeholder="🔍 Buscar por nome, telefone ou email..."
            className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* LISTA DE CLIENTES */}
        {filteredClientes.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="text-lg font-bold">Nenhum cliente encontrado</p>
            <p className="text-sm mt-2">
              {clientes.length === 0 
                ? 'Comece adicionando seu primeiro cliente' 
                : 'Ajuste sua busca e tente novamente'}
            </p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Cadastrar cliente
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredClientes.map(cliente => (
              <div key={cliente.id} className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden">
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{cliente.nome}</h3>
                    <p className="text-xs text-slate-500 mt-1">Cadastrado em {new Date(cliente.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>

                  <div className="space-y-2 text-sm">
                    {cliente.telefone && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">📱</span>
                        <a href={`tel:${cliente.telefone}`} className="text-blue-600 hover:underline">
                          {cliente.telefone}
                        </a>
                      </div>
                    )}
                    {cliente.email && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">✉️</span>
                        <a href={`mailto:${cliente.email}`} className="text-blue-600 hover:underline truncate">
                          {cliente.email}
                        </a>
                      </div>
                    )}
                    {cliente.endereco && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">📍</span>
                        <span className="text-slate-700 truncate">{cliente.endereco}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => navigate(`/clientes/${cliente.id}`)}
                      className="flex-1 rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-2 text-white text-xs font-semibold transition"
                    >
                      Histórico
                    </button>
                    <button
                      onClick={() => navigate(`/orcamento/novo/${cliente.id}`)}
                      className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2 text-white text-xs font-semibold transition"
                    >
                      Orçamento
                    </button>
                    <button
                      onClick={() => openWhatsApp(cliente)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 text-emerald-700 text-xs font-semibold transition"
                    >
                      WhatsApp
                    </button>
                    <button
                      onClick={() => handleRemoveCliente(cliente.id)}
                      className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-2 text-red-700 text-xs font-semibold transition"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL NOVO CLIENTE */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Novo Cliente</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-slate-700">Nome *</label>
                <input
                  value={novoCliente.nome}
                  onChange={e => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                  type="text"
                  placeholder="João Silva"
                  className="w-full p-2 rounded border border-slate-200 text-sm mt-1"
                />
                {formErrors.nome && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.nome[0]}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Telefone *</label>
                <input
                  value={novoCliente.telefone}
                  onChange={e => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
                  type="tel"
                  placeholder="(11) 98765-4321"
                  className="w-full p-2 rounded border border-slate-200 text-sm mt-1"
                />
                {formErrors.telefone && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.telefone[0]}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input
                  value={novoCliente.email}
                  onChange={e => setNovoCliente({ ...novoCliente, email: e.target.value })}
                  type="email"
                  placeholder="email@example.com"
                  className="w-full p-2 rounded border border-slate-200 text-sm mt-1"
                />
                {formErrors.email && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.email[0]}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Endereço</label>
                <input
                  value={novoCliente.endereco}
                  onChange={e => setNovoCliente({ ...novoCliente, endereco: e.target.value })}
                  type="text"
                  placeholder="Rua das Flores, 123"
                  className="w-full p-2 rounded border border-slate-200 text-sm mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddCliente}
                className="flex-1 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 transition"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
