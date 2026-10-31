const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const messaging = admin.messaging();

// ==========================================
// FUNÇÃO 1: ENVIAR AVISO MANUAL (Novos Comunicados)
// ==========================================
async function enviarComunicados() {
  const snap = await db.collection('comunicados').where('notificado', '==', false).get();
  if (snap.empty) return console.log('Nenhum comunicado novo para notificar.');

  const tokensSnap = await db.collection('tokens_push').get();
  const tokens = [];
  tokensSnap.forEach(doc => tokens.push(doc.data().token));

  if (tokens.length === 0) return console.log('Nenhum aluno com token registrado.');

  for (const doc of snap.docs) {
    const aviso = doc.data();
    const payload = {
      notification: {
        title: 'Novo Aviso: ' + aviso.titulo,
        body: aviso.mensagem.substring(0, 100) + '...'
      },
      tokens: tokens
    };

    try {
      await messaging.sendMulticast(payload);
      await doc.ref.update({ notificado: true });
      console.log(`Aviso "${aviso.titulo}" enviado!`);
    } catch (e) {
      console.error('Erro ao enviar aviso:', e);
    }
  }
}

// ==========================================
// FUNÇÃO 2: LEMBRETE DE CONSULTA (Para Amanhã)
// ==========================================
async function enviarLembretesConsultas() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaISO = amanha.toISOString().split('T')[0];

  const snap = await db.collection('agendamentos')
    .where('data', '==', amanhaISO)
    .where('status', '==', 'agendado')
    .get();

  if (snap.empty) return console.log('Nenhuma consulta para amanhã.');

  for (const doc of snap.docs) {
    const ag = doc.data();
    if (!ag.alunoId) continue;

    const tokenDoc = await db.collection('tokens_push').doc(ag.alunoId).get();
    if (!tokenDoc.exists) continue;

    const payload = {
      notification: {
        title: 'Lembrete de Atendimento',
        body: `Você tem um atendimento amanhã às ${ag.horario}. Não se esqueça!`
      },
      token: tokenDoc.data().token
    };

    try {
      await messaging.send(payload);
      console.log(`Lembrete enviado para o aluno ${ag.nomeAluno || ag.alunoId}`);
    } catch (e) {
      console.error('Erro ao enviar lembrete:', e);
    }
  }
}

// Executa as duas funções
async function rodar() {
  console.log("Iniciando envio de notificações...");
  await enviarComunicados();
  await enviarLembretesConsultas();
  console.log("Finalizado!");
}
rodar();