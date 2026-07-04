const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const serviceAccount = require("./firebase-adminsdk.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

function parseTrialEnd(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }
  return null;
}

async function migrateTrialDates() {
  const snapshot = await db.collection("profiles").where("status", "==", "trialing").get();
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const profile = docSnap.data();

    if (profile.trial_ends_at && typeof profile.trial_ends_at.toDate === "function") {
      skipped += 1;
      continue;
    }

    const trialEndsAt = parseTrialEnd(profile.trial_ends_at);

    if (!trialEndsAt) {
      skipped += 1;
      console.warn(`Perfil ${docSnap.id} ignorado: trial_ends_at ausente ou inválido.`);
      continue;
    }

    await docSnap.ref.update({
      trial_ends_at: Timestamp.fromDate(trialEndsAt),
      updated_at: new Date().toISOString(),
    });

    updated += 1;
    console.log(`Perfil ${docSnap.id} migrado para Timestamp.`);
  }

  console.log(`Migração concluída. Atualizados: ${updated}. Ignorados: ${skipped}.`);
}

migrateTrialDates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro ao migrar datas de trial:", error);
    process.exit(1);
  });
