# OrcaJa Web

Aplicativo SaaS para prestadores criarem clientes, orcamentos, PDFs e acompanharem status comerciais.

## Stack

- React + Vite
- Firebase Auth
- Firestore
- Firebase Cloud Functions
- Firebase Storage
- Vercel Serverless Functions
- PWA

## Rodar local

```bash
npm install
cp .env.example .env
npm run dev
```

## Scripts

```bash
npm run lint
npm run build
npm run firebase:emulators
npm run firebase:deploy:rules
```

## Firebase

Leia o passo a passo em `docs/FIREBASE_SETUP.md`.

## SaaS readiness

Leia o checklist comercial em `docs/SAAS_READINESS.md`.

## Deploy

Configure as variaveis `VITE_FIREBASE_*` na Vercel e publique o frontend normalmente. A API de comparacao de precos fica em `/api/comparar-precos`.
