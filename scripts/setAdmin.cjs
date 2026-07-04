const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const serviceAccount = require("./firebase-adminsdk.json");

initializeApp({
  credential: cert(serviceAccount),
});

async function setAdmin() {
  const email = process.env.ADMIN_EMAIL;

  if (!email) {
    console.error("Informe o email do admin com ADMIN_EMAIL=seu-email@dominio.com");
    process.exit(1);
  }

  try {
    const user = await getAuth().getUserByEmail(email);

    await getAuth().setCustomUserClaims(user.uid, {
      admin: true,
    });

    console.log(`Usuário ${email} agora é ADMIN.`);
    console.log(`UID: ${user.uid}`);
    process.exit(0);
  } catch (error) {
    console.error("Erro ao definir admin:", error);
    process.exit(1);
  }
}

setAdmin();