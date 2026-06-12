const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

const db = getFirestore();
const REGION = 'southamerica-east1';
const VALID_STATUSES = new Set(['trialing', 'active', 'blocked', 'cancelled']);
const VALID_PLANS = new Set(['trial', 'starter', 'pro', 'business']);

function assertSignedIn(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  }
}

function assertAdmin(request) {
  assertSignedIn(request);

  if (request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Apenas administradores podem executar esta ação.');
  }
}

function sanitizeString(value, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength);
}

exports.setTenantStatus = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);

  const uid = sanitizeString(request.data.uid, 128);
  const status = sanitizeString(request.data.status, 32);

  if (!uid || !VALID_STATUSES.has(status)) {
    throw new HttpsError('invalid-argument', 'Informe uid e status válido.');
  }

  await Promise.all([
    db.collection('profiles').doc(uid).set({
      status,
      updated_at: new Date().toISOString(),
      updated_by: request.auth.uid,
    }, { merge: true }),
    getAuth().updateUser(uid, { disabled: status === 'blocked' || status === 'cancelled' }),
  ]);

  return { uid, status };
});

exports.setTenantPlan = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);

  const uid = sanitizeString(request.data.uid, 128);
  const plan = sanitizeString(request.data.plan, 32);

  if (!uid || !VALID_PLANS.has(plan)) {
    throw new HttpsError('invalid-argument', 'Informe uid e plano válido.');
  }

  await db.collection('profiles').doc(uid).set({
    plan,
    updated_at: new Date().toISOString(),
    updated_by: request.auth.uid,
  }, { merge: true });

  return { uid, plan };
});

exports.recordUsage = onCall({ region: REGION }, async (request) => {
  assertSignedIn(request);

  const feature = sanitizeString(request.data.feature, 80);
  if (!feature) {
    throw new HttpsError('invalid-argument', 'Informe a funcionalidade utilizada.');
  }

  const usageRef = db.collection('usage').doc(request.auth.uid);
  await usageRef.set({
    [`features.${feature}`]: FieldValue.increment(1),
    updated_at: new Date().toISOString(),
  }, { merge: true });

  return { ok: true };
});

exports.gerarOrcamentoComIA = onCall({ region: REGION }, async (request) => {
  assertSignedIn(request);

  const prompt = sanitizeString(request.data.prompt, 3000);
  if (prompt.length < 10) {
    throw new HttpsError('invalid-argument', 'Descreva melhor o serviço para gerar sugestões.');
  }

  await db.collection('usage').doc(request.auth.uid).set({
    'features.ai_budget_generations': FieldValue.increment(1),
    updated_at: new Date().toISOString(),
  }, { merge: true });

  // Produção: conecte aqui seu provedor de IA com uma chave guardada em Secret Manager.
  return {
    materiais: [
      { nome: 'Materiais principais do serviço', qtd: 1, precoVenda: 120, custo: 90 },
      { nome: 'Insumos e acabamento', qtd: 1, precoVenda: 45, custo: 30 },
    ],
    servicos: [
      { descricao: `Execução: ${prompt.slice(0, 80)}`, horas: 2, valorHora: 90 },
    ],
  };
});
