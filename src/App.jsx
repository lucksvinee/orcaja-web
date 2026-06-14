import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import DashboardPage from './components/Dashboard';
import ClientesPage from './ClientesPage';
import ClienteDetailPage from './components/ClienteDetail';
import NovoOrcamentoPage from './components/NovoOrcamento';
import LoginPage from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import BlockedPage from './components/BlockedPage';
import { auth, db } from './firebase';
import { ensureTenantProfile } from './profileUtils';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const RequireActiveTenant = ({ children, session, profile }) => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!profile) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Verificando acesso...</div>;
  }
  if (profile.error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-red-600 p-4 text-center">
        <h2 className="text-xl font-bold mb-2">Erro de Acesso ao Perfil</h2>
        <p>{profile.message}</p>
        <p className="text-sm mt-4 text-gray-500">Isto provavelmente é um erro de regras de segurança (Firestore Rules) no Firebase.</p>
      </div>
    );
  }
  if (profile.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  if (profile.status === 'blocked') {
    return <Navigate to="/bloqueado" replace />;
  }
  return children;
};

const RequireAdmin = ({ children, session, profile }) => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!profile) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Verificando privilégios...</div>;
  }
  if (profile.error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-red-600 p-4 text-center">
        <h2 className="text-xl font-bold mb-2">Erro de Acesso (Admin)</h2>
        <p>{profile.message}</p>
      </div>
    );
  }
  if (profile.role !== 'admin') {
    return <Navigate to="/" replace />; // Redireciona tenant curioso de volta pro dashboard dele
  }
  return children;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const sessionData = { user: { id: user.uid, email: user.email } };
        setSession(sessionData);
        try {
          const idTokenResult = await user.getIdTokenResult();
          const profileRef = doc(db, 'profiles', user.uid);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            setProfile({
              id: user.uid,
              ...profileData,
              role: idTokenResult.claims.admin ? 'admin' : profileData.role
            });
          } else if (idTokenResult.claims.admin) {
            setProfile({ id: user.uid, email: user.email, role: 'admin', status: 'active' });
          } else {
            const createdProfile = await ensureTenantProfile(db, user);
            setProfile({
              id: user.uid,
              ...createdProfile
            });
          }
        } catch (profileError) {
          console.error('Erro ao buscar perfil:', profileError);
          setProfile({ error: true, message: profileError.message });
        }
      } else {
        setSession(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Carregando OrcaJá...</div>;
  }

  return (
    <div className="app-shell">
      <div className="app-wrapper">
        <Routes>
          <Route path="/login" element={!session ? <LoginPage /> : (profile?.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/" replace />)} />
          <Route path="/bloqueado" element={session && profile?.status === 'blocked' ? <BlockedPage /> : <Navigate to="/" replace />} />
          
          {/* Rotas do Super Admin */}
          <Route path="/admin" element={<RequireAdmin session={session} profile={profile}><AdminDashboard /></RequireAdmin>} />
          
          {/* Rotas do Tenant (Prestador) */}
          <Route path="/" element={<RequireActiveTenant session={session} profile={profile}><DashboardPage /></RequireActiveTenant>} />
          <Route path="/clientes" element={<RequireActiveTenant session={session} profile={profile}><ClientesPage /></RequireActiveTenant>} />
          <Route path="/clientes/:id" element={<RequireActiveTenant session={session} profile={profile}><ClienteDetailPage /></RequireActiveTenant>} />
          <Route path="/orcamento/novo" element={<RequireActiveTenant session={session} profile={profile}><NovoOrcamentoPage /></RequireActiveTenant>} />
          <Route path="/orcamento/novo/:clienteId" element={<RequireActiveTenant session={session} profile={profile}><NovoOrcamentoPage /></RequireActiveTenant>} />
          <Route path="/orcamento/editar/:orcamentoId" element={<RequireActiveTenant session={session} profile={profile}><NovoOrcamentoPage /></RequireActiveTenant>} />
        </Routes>
      </div>
    </div>
  );
}
