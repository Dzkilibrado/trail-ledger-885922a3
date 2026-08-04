import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.trailbook.app",
  appName: "TrailBook",
  // Não usamos o build SSR completo aqui: o app carrega o site publicado
  // via server.url abaixo. Esta pasta só serve de fallback local mínimo,
  // exigido pelo Capacitor para inicializar o projeto Android.
  webDir: "capacitor-www",
  server: {
    // O app carrega o site já publicado via Lovable neste domínio próprio.
    // Isso mantém o app sempre sincronizado com o que está publicado,
    // sem precisar gerar um novo APK a cada ajuste de conteúdo/UI.
    url: "https://www.trailbook.com.br",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      // Reserva o espaço da barra de status (hora, wifi, bateria) em vez de
      // deixar o app renderizar por baixo dela — era isso que causava a
      // sobreposição na tela inicial.
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#1a1815",
    },
  },
};

export default config;
