# Configuracao Firebase do OrcaJa

Este guia deixa o projeto pronto para operar como SaaS com Firebase Authentication, Firestore, Storage e Cloud Functions.

## 1. Criar projeto Firebase

1. Acesse o Firebase Console.
2. Crie um projeto para producao, por exemplo `orcaja-prod`.
3. Ative Google Analytics se voce quiser metricas de uso.
4. No menu Build, abra Authentication e ative o provedor Email/Senha.
5. No menu Build, abra Firestore Database e crie o banco em modo de producao.
6. Escolha uma regiao proxima dos clientes, como `southamerica-east1` quando disponivel.
7. No menu Build, abra Storage e crie o bucket padrao se for usar logos/anexos.

## 2. Criar app Web e variaveis

1. Em Project settings, clique em Add app e escolha Web.
2. Copie as credenciais do SDK Web.
3. Crie um arquivo `.env` local a partir de `.env.example`.
4. Preencha:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_USE_FIREBASE_EMULATORS=false
```

Essas chaves do SDK Web nao sao segredo absoluto, mas o acesso real aos dados precisa ser protegido pelas Rules.

## 3. Instalar e conectar Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

Escolha o projeto criado e defina um alias como `prod`.

## 4. Publicar Firestore Rules, indexes e Storage Rules

Revise os arquivos:

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `firebase.json`

Depois publique:

```bash
npm run firebase:deploy:rules
```

As Rules isolam `clientes`, `orcamentos`, `company_profiles` e `catalog_overrides` por `user_id`. Administracao global depende de custom claim `admin`.

## 5. Configurar primeiro administrador

Crie seu usuario pelo app ou pelo Firebase Console. Depois pegue o UID em Authentication.

Execute uma vez em ambiente confiavel com Firebase Admin SDK ou use o shell do seu backend:

```js
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

const uid = 'COLE_O_UID_AQUI';

await getAuth().setCustomUserClaims(uid, { admin: true });
await getFirestore().collection('profiles').doc(uid).set({
  email: 'seu-email@dominio.com',
  role: 'admin',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}, { merge: true });
```

Depois faca logout/login no app para o token carregar a claim nova.

## 6. Publicar Cloud Functions

As funcoes ficam em `functions/`:

- `setTenantStatus`: ativa, bloqueia ou cancela clientes.
- `setTenantPlan`: troca plano comercial.
- `recordUsage`: registra uso por funcionalidade.
- `gerarOrcamentoComIA`: placeholder autenticado para a geracao por IA.

Instale as dependencias e publique:

```bash
cd functions
npm install
npm run deploy
```

Para usar IA real, conecte o provedor dentro de `functions/index.js` e guarde chaves em Secret Manager, nao no frontend.

## 7. Emuladores para desenvolvimento

No `.env`, use:

```bash
VITE_USE_FIREBASE_EMULATORS=true
```

Rode:

```bash
npm run firebase:emulators
npm run dev
```

O arquivo `src/firebase.js` conecta Auth, Firestore e Functions aos emuladores quando essa flag esta ativa em desenvolvimento.

## 8. Checklist antes de vender

- Regras publicadas em producao.
- Primeiro admin com custom claim configurada.
- Usuario comum nao consegue ler dados de outro usuario.
- Usuario bloqueado nao consegue criar/editar clientes e orcamentos.
- Functions publicadas na mesma regiao configurada no client.
- Variaveis `.env` configuradas na Vercel.
- API `/api/comparar-precos` funcionando no deploy.
- Politica de privacidade e termos publicados.
- Processo de backup/exportacao definido.
