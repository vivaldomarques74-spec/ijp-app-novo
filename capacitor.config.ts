import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ID do aplicativo (não mude, pois é a identidade única dele na Play Store)
  appId: 'br.org.ijp.app',
  
  // Nome que aparecerá no celular
  appName: 'Instituto Jovens Periféricos',
  
  // Pasta onde o Vite gera o código compilado
  webDir: 'dist',
  
  // Configurações de plugins
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000, // Tempo que a tela de abertura fica visível (3 segundos)
      launchAutoHide: true,     // Esconde automaticamente após o tempo
      backgroundColor: "#ffffff", // Cor de fundo enquanto a imagem não carrega
      androidSplashResourceName: "splash", // Nome do arquivo da imagem no Android
      androidScaleType: "CENTER_CROP", // Ajusta a imagem para preencher a tela sem distorcer
      showSpinner: false, // Não mostra a bolinha girando
    }
  }
};

export default config;