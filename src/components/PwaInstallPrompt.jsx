import { useEffect, useState } from 'react';

const DISMISS_KEY = 'orcaja-pwa-install-dismissed-at';
const DISMISS_DAYS = 7;

const isStandaloneMode = () => (
  window.matchMedia?.('(display-mode: standalone)').matches
  || window.navigator.standalone === true
);

const isIosDevice = () => (
  /iphone|ipad|ipod/i.test(window.navigator.userAgent)
  || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
);

const isAndroidDevice = () => /android/i.test(window.navigator.userAgent);

const wasRecentlyDismissed = () => {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY));
    if (!dismissedAt) return false;

    const dismissedMs = DISMISS_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < dismissedMs;
  } catch {
    return false;
  }
};

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [manualInstallHint, setManualInstallHint] = useState(() => (
    !isStandaloneMode()
    && !wasRecentlyDismissed()
    && isIosDevice()
  ));
  const [visible, setVisible] = useState(() => (
    !isStandaloneMode()
    && !wasRecentlyDismissed()
    && isIosDevice()
  ));

  useEffect(() => {
    if (isStandaloneMode() || wasRecentlyDismissed() || isIosDevice()) {
      return undefined;
    }

    const fallbackTimer = window.setTimeout(() => {
      if (isAndroidDevice()) {
        setManualInstallHint(true);
        setVisible(true);
      }
    }, 2500);

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      window.clearTimeout(fallbackTimer);
      setDeferredPrompt(event);
      setManualInstallHint(false);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      window.clearTimeout(fallbackTimer);
      setDeferredPrompt(null);
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignora navegadores que bloqueiam armazenamento local.
    }
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible || (!deferredPrompt && !manualInstallHint)) {
    return null;
  }

  const manualMessage = isIosDevice()
    ? 'No iPhone, abra Compartilhar e toque em Adicionar à Tela de Início.'
    : 'Se o botão de instalação não aparecer, abra o menu do navegador e toque em Instalar app ou Adicionar à tela inicial.';

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4 print:hidden">
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-xl">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-black text-white">
          OJ
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Usar OrcaJá como app</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {manualInstallHint ? manualMessage : 'Instale no celular para abrir pela tela inicial.'}
          </p>
          <div className="mt-3 flex gap-2">
            {!manualInstallHint && (
              <button
                type="button"
                onClick={install}
                className="rounded-md bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
              >
                Instalar
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              Agora não
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar aviso de instalação"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          x
        </button>
      </div>
    </div>
  );
}
