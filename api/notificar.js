// api/notificar.js
import admin from 'firebase-admin';

// Inicializa o Firebase Admin apenas uma vez
if (!admin.apps.length) {
  try {
    // Pega a chave que salvamos na Vercel e transforma de string para JSON
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    // Corrige as quebras de linha da chave privada
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
  }
}

const db = admin.firestore();
const messaging = admin.messaging();

export default async function handler(req, res) {
  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { titulo, mensagem, publicoAlvo, cursoId, turmaId } = req.body;

  if (!titulo || !mensagem) {
    return res.status(400).json({ error: 'Título e mensagem são obrigatórios' });
  }

  try {
    let tokens = [];

    // 1. Busca os tokens dependendo do público
    if (publicoAlvo === 'turma' && turmaId) {
      // Busca alunos da turma
      const turmaSnap = await db.collection('cursos').doc(cursoId).collection('turmas').doc(turmaId).get();
      const alunosIds = turmaSnap.data().alunos || [];
      
      // Busca os tokens desses alunos
      const tokensSnap = await db.collection('tokens_push').get();
      tokensSnap.forEach(doc => {
        if (alunosIds.includes(doc.data().alunoId)) {
          tokens.push(doc.data().token);
        }
      });
    } else {
      // Busca todos os tokens (para "todos os alunos")
      const tokensSnap = await db.collection('tokens_push').get();
      tokensSnap.forEach(doc => tokens.push(doc.data().token));
    }

    if (tokens.length === 0) {
      return res.status(200).json({ message: 'Nenhum token encontrado para envio.' });
    }

    // 2. Monta o payload da notificação
    const payload = {
      notification: {
        title: titulo,
        body: mensagem,
      },
      tokens: tokens,
    };

    // 3. Dispara o Push via Firebase
    const response = await messaging.sendMulticast(payload);
    
    return res.status(200).json({ 
      success: true, 
      enviados: response.successCount,
      falhas: response.failureCount
    });

  } catch (error) {
    console.error('Erro ao disparar notificação:', error);
    return res.status(500).json({ error: 'Erro interno ao enviar notificação' });
  }
}