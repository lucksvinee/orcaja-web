const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = require("./firebase-adminsdk.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

function toPublicNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function toPublicText(value, fallback, limit = 140) {
  const text = String(value || fallback).trim();
  return text.slice(0, limit);
}

function buildPublicMaterial(item) {
  return {
    nome: toPublicText(item && item.nome, "Material"),
    qtd: toPublicNumber(item && item.qtd),
    precoVenda: toPublicNumber(item && item.precoVenda),
  };
}

function buildPublicServico(item) {
  return {
    descricao: toPublicText(item && item.descricao, "Servico"),
    horas: toPublicNumber(item && item.horas),
    valorHora: toPublicNumber(item && item.valorHora),
  };
}

function stableStringify(value) {
  return JSON.stringify(value || []);
}

async function sanitizePublicOrcamentos() {
  const snapshot = await db.collection("public_orcamentos").get();
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const safeItens = Array.isArray(data.itens) ? data.itens.map(buildPublicMaterial) : [];
    const safeServicos = Array.isArray(data.servicos) ? data.servicos.map(buildPublicServico) : [];

    if (
      stableStringify(data.itens) === stableStringify(safeItens)
      && stableStringify(data.servicos) === stableStringify(safeServicos)
    ) {
      skipped += 1;
      continue;
    }

    await docSnap.ref.update({
      itens: safeItens,
      servicos: safeServicos,
      updated_at: new Date().toISOString(),
    });

    updated += 1;
    console.log(`Proposta publica ${docSnap.id} higienizada.`);
  }

  console.log(`Higienizacao concluida. Atualizados: ${updated}. Ignorados: ${skipped}.`);
}

sanitizePublicOrcamentos()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro ao higienizar propostas publicas:", error);
    process.exit(1);
  });
