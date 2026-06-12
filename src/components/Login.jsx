import { useState } from 'react';
import logo from '../assets/scarface-logo.png';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const getTrialEndsAt = () => {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);
  return trialEndsAt.toISOString();
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setMsg('');

    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) {
      setErro(error.message);
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!email || !senha) {
      setErro('Preencha email e senha para criar uma conta.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErro('Por favor, insira um email válido.');
      return;
    }

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setErro('');
    setMsg('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      await setDoc(doc(db, 'profiles', userCredential.user.uid), {
        email: userCredential.user.email,
        role: 'tenant',
        status: 'trialing',
        plan: 'trial',
        trial_ends_at: getTrialEndsAt(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      setMsg('Conta criada com sucesso! Redirecionando...');
    } catch (error) {
      setErro(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <img src={logo} alt="Logo" className="w-20 h-20 mx-auto rounded-2xl bg-slate-100 p-2 mb-4" />
          <h1 className="text-2xl font-black text-slate-900">Bem-vindo ao OrcaJá</h1>
          <p className="text-sm text-slate-500 mt-2">Faça login para acessar o sistema</p>
        </div>

        {erro && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 text-center">
            {erro}
          </div>
        )}
        {msg && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm mb-6 text-center">
            {msg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Senha</label>
            <input 
              type="password" 
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              placeholder="••••••••"
            />
          </div>
          <div className="flex gap-2 mt-6">
            <button 
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50"
            >
              Criar Conta
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">Desenvolvido por Scarface Solutions</p>
        </div>
      </div>
    </div>
  );
}
