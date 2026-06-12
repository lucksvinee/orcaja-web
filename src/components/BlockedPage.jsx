import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function BlockedPage() {
  const navigate = useNavigate();

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
        <h1 className="text-2xl font-black text-slate-900">Acesso Restrito</h1>
        <p className="text-slate-600">
          Para utilizar o sistema OrcaJá, é necessário ter uma assinatura ativa.
        </p>
        <div className="bg-yellow-50 p-4 rounded-lg text-sm text-yellow-800 text-left">
          <strong>Próximos passos:</strong>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Se você acabou de criar sua conta, aguarde a liberação após a confirmação do pagamento.</li>
            <li>Se sua assinatura venceu, entre em contato para regularizar e reativar seu acesso.</li>
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
