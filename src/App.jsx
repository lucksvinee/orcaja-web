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
import { auth, db, firebaseReady, missingFirebaseVars } from './firebase';
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
  if (!['trialing', 'active'].includes(profile.status)) {
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

const FirebaseSetupNotice = () => (
  <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center">
      <div className="w-full rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-300">Configuração pendente</p>
        <h1 className="mt-3 text-2xl font-black">Configure o Firebase para iniciar o OrcaJá</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          O app carregou, mas as variáveis do Firebase no arquivo <code className="rounded bg-slate-800 px-1.5 py-0.5">.env</code> estão vazias.
          Preencha as chaves abaixo, salve o arquivo e reinicie o servidor com <code className="rounded bg-slate-800 px-1.5 py-0.5">npm run dev</code>.
        </p>

        <div className="mt-5 rounded-lg border border-slate-700 bg-slate-950 p-4">
          <p className="text-sm font-bold text-slate-200">Variáveis faltando:</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {missingFirebaseVars.map((name) => (
              <li key={name} className="font-mono">{name}</li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-sm text-slate-400">
          As instruções completas estão em <code className="rounded bg-slate-800 px-1.5 py-0.5">docs/FIREBASE_SETUP.md</code>.
        </p>
      </div>
    </div>
  </div>
);

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(firebaseReady);

  useEffect(() => {
    if (!firebaseReady) {
      return undefined;
    }

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

  if (!firebaseReady) {
    return <FirebaseSetupNotice />;
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
