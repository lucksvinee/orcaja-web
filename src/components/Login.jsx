import { useEffect, useState } from 'react';
import logo from '../assets/logoOrcaJa.png';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect
} from 'firebase/auth';
import { ensureTenantProfile } from '../profileUtils';

const MIN_PASSWORD_LENGTH = 8;

const getResetActionSettings = () => ({
  url: `${window.location.origin}/login`,
  handleCodeInApp: false
});

const getFriendlyAuthError = (error) => {
  const messages = {
    'auth/email-already-in-use': 'Esse e-mail já tem uma conta. Clique em Entrar ou use Esqueci minha senha.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Digite um e-mail válido.',
    'auth/missing-password': 'Digite sua senha.',
    'auth/account-exists-with-different-credential': 'Este e-mail já existe com outro método de login.',
    'auth/cancelled-popup-request': 'A janela de login foi cancelada. Tente novamente.',
    'auth/operation-not-supported-in-this-environment': 'Este navegador exige login por redirecionamento.',
    'auth/operation-not-allowed': 'Ative o provedor Google no Firebase Authentication.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Tente novamente.',
    'auth/popup-closed-by-user': 'Login com Google cancelado.',
    'auth/redirect-cancelled-by-user': 'Login com Google cancelado.',
    'auth/redirect-operation-pending': 'Já existe um login em andamento.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase Authentication.',
    'auth/user-disabled': 'Esta conta foi desativada. Entre em contato com o suporte.',
    'auth/user-not-found': 'Conta não encontrada. Confira o e-mail ou crie uma conta.',
    'auth/web-storage-unsupported': 'Este modo do navegador bloqueou o armazenamento necessário para manter o login.',
    'auth/weak-password': `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    'auth/wrong-password': 'Senha incorreta.'
  };

  return messages[error?.code] || error?.message || 'Não foi possível concluir a operação.';
};

const createGoogleProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

const shouldFallbackToRedirect = (error) => {
  return [
    'auth/cancelled-popup-request',
    'auth/operation-not-supported-in-this-environment',
    'auth/popup-blocked',
  ].includes(error?.code);
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!auth) return undefined;

    let isMounted = true;
    globalThis.__ORCAJA_GOOGLE_REDIRECT_PROMISE__ ??= getRedirectResult(auth);

    const completeRedirectLogin = async () => {
      setLoading(true);
      try {
        const result = await globalThis.__ORCAJA_GOOGLE_REDIRECT_PROMISE__;
        if (result?.user) {
          await ensureTenantProfile(db, result.user);
          if (isMounted) {
            setMsg('Login com Google realizado com sucesso.');
          }
        }
      } catch (error) {
        if (isMounted) {
          setErro(getFriendlyAuthError(error));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    completeRedirectLogin();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setMsg('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), senha);
      await ensureTenantProfile(db, userCredential.user);
    } catch (error) {
      setErro(getFriendlyAuthError(error));
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErro('');
    setMsg('');

    try {
      const provider = createGoogleProvider();
      const userCredential = await signInWithPopup(auth, provider);
      await ensureTenantProfile(db, userCredential.user);
      setMsg('Login com Google realizado com sucesso.');
    } catch (error) {
      if (shouldFallbackToRedirect(error)) {
        try {
          setMsg('Abrindo login do Google...');
          await signInWithRedirect(auth, createGoogleProvider());
          return;
        } catch (redirectError) {
          setErro(getFriendlyAuthError(redirectError));
        }
      } else {
        setErro(getFriendlyAuthError(error));
      }
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

    if (senha.length < MIN_PASSWORD_LENGTH) {
      setErro(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setLoading(true);
    setErro('');
    setMsg('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), senha);
      await ensureTenantProfile(db, userCredential.user);
      setMsg('Conta criada com sucesso! Redirecionando...');
    } catch (error) {
      setErro(getFriendlyAuthError(error));
    }
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setErro('Digite seu e-mail para receber o link de recuperação.');
      return;
    }

    setLoading(true);
    setErro('');
    setMsg('');

    try {
      await sendPasswordResetEmail(auth, email.trim(), getResetActionSettings());
      setMsg('Se houver uma conta com esse e-mail, enviaremos um link de recuperação.');
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        setMsg('Se houver uma conta com esse e-mail, enviaremos um link de recuperação.');
      } else {
        setErro(getFriendlyAuthError(error));
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <img src={logo} alt="OrcaJá" className="w-20 h-20 mx-auto rounded-2xl bg-slate-100 p-2 mb-4" />
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

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mb-5 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-base font-black text-blue-600 shadow-sm ring-1 ring-slate-200">
            G
          </span>
          {loading ? 'Aguarde...' : 'Entrar com Google'}
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-bold uppercase text-slate-400">ou</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

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
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={loading}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                Esqueci minha senha
              </button>
            </div>
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
          <p className="text-xs text-slate-400">Desenvolvido por Lucas Inacio</p>
        </div>
      </div>
    </div>
  );
}
