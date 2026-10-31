import { PushNotifications } from '@capacitor/push-notifications';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function inicializarNotificacoes(alunoId: string) {
  try {
    // 1. Pede permissão
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('Usuário negou permissão para notificações.');
      return;
    }

    // 2. Registra no FCM
    await PushNotifications.register();

    // 3. Escuta o token e salva no Firestore
    await PushNotifications.addListener('registration', async (token) => {
      try {
        await setDoc(doc(db, 'tokens_push', alunoId), {
          token: token.value,
          alunoId: alunoId,
          atualizadoEm: serverTimestamp(),
        });
        console.log('Token salvo no Firestore:', token.value);
      } catch (e) {
        console.error('Erro ao salvar token:', e);
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Erro no registro de notificações:', error);
    });

  } catch (e) {
    console.error('Erro ao inicializar notificações:', e);
  }
}