import { useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';
import { auth } from '../firebase';

const MIN_PASSWORD_LENGTH = 8;

const getResetActionSettings = () => ({
  url: `${window.location.origin}/login`,
  handleCodeInApp: false
});

const getFriendlyPasswordError = (error) => {
  const messages = {
    'auth/invalid-credential': 'Senha atual incorreta.',
    'auth/missing-password': 'Digite sua senha atual.',
    'auth/requires-recent-login': 'Entre novamente e tente trocar a senha.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/weak-password': `Use uma senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    'auth/wrong-password': 'Senha atual incorreta.'
  };

  return messages[error?.code] || error?.message || 'Não foi possível atualizar a senha.';
};

export default function PasswordSecurityModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const user = auth.currentUser;
  const email = user?.email || '';

  const close = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage('');
    setError('');
    onClose();
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!user || !email) {
      setError('Entre novamente para alterar sua senha.');
      return;
    }

    if (!currentPassword) {
      setError('Digite sua senha atual.');
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas novas não conferem.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('Use uma senha diferente da atual.');
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Senha alterada com sucesso.');
    } catch (passwordError) {
      setError(getFriendlyPasswordError(passwordError));
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async () => {
    setMessage('');
    setError('');

    if (!email) {
      setError('Entre novamente para receber o link de recuperação.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email, getResetActionSettings());
      setMessage('Enviamos um link de recuperação para seu e-mail.');
    } catch (resetError) {
      setError(getFriendlyPasswordError(resetError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Segurança</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Alterar senha</h2>
            {email && <p className="mt-1 text-sm text-slate-500">{email}</p>}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar alteração de senha"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            x
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="mt-5 space-y-3">
          <label className="block text-sm font-bold text-slate-700">
            Senha atual
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Nova senha
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Confirmar nova senha
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-bold text-slate-800">Perdeu a senha?</p>
          <button
            type="button"
            onClick={handleSendReset}
            disabled={loading}
            className="mt-2 text-sm font-bold text-blue-600 hover:text-blue-700 disabled:opacity-60"
          >
            Enviar link de recuperação
          </button>
        </div>
      </div>
    </div>
  );
}
