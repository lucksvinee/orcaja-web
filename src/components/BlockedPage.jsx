import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { getTenantBlockReason, getTrialEndsAtFromProfile } from '../profileUtils';

const formatDate = (date) => {
  if (!date) return null;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const getPageContent = (profile) => {
  const reason = getTenantBlockReason(profile);
  const trialEndsAt = formatDate(getTrialEndsAtFromProfile(profile));

  if (reason === 'trial_expired') {
    return {
      title: 'Seu teste gratuito expirou',
      message: `O período gratuito${trialEndsAt ? ` terminou em ${trialEndsAt}` : ' terminou'}. Para continuar usando o OrcaJá, é necessário ativar uma assinatura paga.`,
      steps: [
        'Entre em contato com o administrador para receber as opções de pagamento.',
        'Após a confirmação do pagamento, seu acesso será reativado no painel administrativo.'
      ]
    };
  }

  if (reason === 'cancelled') {
    return {
      title: 'Assinatura cancelada',
      message: 'Esta conta foi cancelada e não possui acesso ativo ao OrcaJá.',
      steps: [
        'Entre em contato com o administrador se deseja contratar novamente.',
        'Com a assinatura reativada, seus dados voltam a ficar disponíveis no sistema.'
      ]
    };
  }

  return {
    title: 'Acesso restrito',
    message: 'Para utilizar o sistema OrcaJá, é necessário ter uma assinatura ativa.',
    steps: [
      'Se você acabou de criar sua conta, aguarde a liberação após a confirmação do pagamento.',
      'Se sua assinatura venceu, entre em contato para regularizar e reativar seu acesso.'
    ]
  };
};

export default function BlockedPage({ profile }) {
  const navigate = useNavigate();
  const content = getPageContent(profile);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-center space-y-6">
        <div className="text-yellow-500 text-6xl mb-4">
          🔒
        </div>
        <h1 className="text-2xl font-black text-slate-900">{content.title}</h1>
        <p className="text-slate-600">
          {content.message}
        </p>
        <div className="bg-yellow-50 p-4 rounded-lg text-sm text-yellow-800 text-left">
          <strong>Próximos passos:</strong>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            {content.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
        <button
          onClick={handleLogout}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg transition-all active:scale-95"
        >
          Sair da Conta
        </button>
      </div>
    </div>
  );
}
