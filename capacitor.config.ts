import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.trailbook.app",
  appName: "TrailBook",
  webDir: "dist/client",
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
};

export default config;
