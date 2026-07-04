import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { getProfileDate, getTrialEndsAtFromProfile, isTrialExpired } from '../profileUtils';

const formatDate = (value) => {
  const date = getProfileDate(value);
  if (!date) return 'Não informado';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'profiles'));
      const profilesList = [];
      querySnapshot.forEach((docSnap) => {
        profilesList.push({ id: docSnap.id, ...docSnap.data() });
      });
      profilesList.sort((a, b) => {
        const createdAtA = getProfileDate(a.created_at)?.getTime() || 0;
        const createdAtB = getProfileDate(b.created_at)?.getTime() || 0;
        return createdAtB - createdAtA;
      });
      setProfiles(profilesList);
    } catch (error) {
      console.error('Erro ao buscar perfis:', error);
      alert('Erro ao carregar inquilinos. Você tem permissão de Admin?');
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchProfiles();
  }, []);

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      await updateDoc(doc(db, 'profiles', id), {
        status: newStatus,
        updated_at: new Date().toISOString()
      });
      setProfiles(profiles.map(p => p.id === id ? { ...p, status: newStatus } : p));
    } catch (error) {
      alert('Erro ao atualizar status: ' + (error.message || 'Sem permissão'));
    }
  };

  const getStatusLabel = (profile) => {
    if (isTrialExpired(profile)) return 'TRIAL EXPIRADO';

    const labels = {
      active: 'ATIVO',
      trialing: 'TRIAL',
      blocked: 'BLOQUEADO',
      cancelled: 'CANCELADO'
    };

    return labels[profile.status] || 'INDEFINIDO';
  };

  const getStatusClass = (profile) => {
    if (isTrialExpired(profile)) return 'bg-red-100 text-red-700';
    if (profile.status === 'active') return 'bg-emerald-100 text-emerald-700';
    if (profile.status === 'trialing') return 'bg-blue-100 text-blue-700';
    if (profile.status === 'cancelled') return 'bg-slate-200 text-slate-700';
    return 'bg-red-100 text-red-700';
  };

  const deleteTenant = async (id) => {
    if (window.confirm('Tem certeza que deseja cancelar este cliente? O usuário perderá o acesso ao sistema.')) {
      try {
        await updateDoc(doc(db, 'profiles', id), {
          status: 'cancelled',
          updated_at: new Date().toISOString()
        });
        setProfiles(profiles.map(p => p.id === id ? { ...p, status: 'cancelled' } : p));
      } catch (error) {
        alert('Erro ao cancelar perfil: ' + (error.message || 'Sem permissão'));
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando painel admin...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white p-4 shadow-lg flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">👑 Super Admin - OrcaJá</h1>
          <p className="text-xs text-slate-400">Gestão de Inquilinos (SaaS)</p>
        </div>
        <button onClick={handleLogout} className="bg-slate-700 hover:bg-slate-800 px-4 py-2 rounded text-sm font-semibold">
          Sair
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">Prestadores de Serviço ({profiles.length})</h2>
            <button onClick={fetchProfiles} className="text-sm text-blue-600 hover:underline">Atualizar Lista</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-4">Usuário / Email</th>
                  <th className="p-4">Papel (Role)</th>
                  <th className="p-4">Data de Cadastro</th>
                  <th className="p-4">Trial</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map(profile => (
                  <tr key={profile.id} className="hover:bg-slate-50 transition">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{profile.email || 'Email não disponível'}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">ID: {profile.id}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${profile.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {profile.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {formatDate(profile.created_at)}
                    </td>
                    <td className="p-4 text-slate-600">
                      {profile.role === 'admin' ? '-' : formatDate(getTrialEndsAtFromProfile(profile))}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusClass(profile)}`}>
                        {getStatusLabel(profile)}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {profile.role !== 'admin' && (
                        <>
                          <button
                            onClick={() => toggleStatus(profile.id, profile.status)}
                            className={`px-3 py-1 rounded text-xs font-bold text-white transition ${profile.status === 'active' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                          >
                            {profile.status === 'active' ? 'Bloquear' : 'Liberar'}
                          </button>
                          <button
                            onClick={() => deleteTenant(profile.id)}
                            className="px-3 py-1 rounded text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-sm"
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-500">Nenhum perfil encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
