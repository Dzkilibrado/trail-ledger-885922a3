import { Capacitor } from "@capacitor/core";

/**
 * Abre uma URL externa (ou a página institucional /site, que por decisão de
 * arquitetura é tratada como uma experiência independente do app — ADR 0017).
 *
 * Dentro do app nativo (Capacitor/Android), um <a target="_blank"> comum não
 * funciona de forma confiável: o WebView do app não sabe abrir uma "nova
 * aba" de verdade. Dependendo do aparelho, ele navega a própria tela do app
 * para a URL externa — e ao voltar (botão de voltar do Android), o app pode
 * ficar num estado quebrado e cair na tela de erro genérica.
 *
 * A forma correta é abrir num navegador in-app separado (Custom Tabs no
 * Android / SFSafariViewController no iOS), via @capacitor/browser — isso
 * nunca navega o WebView do próprio app, então voltar nunca quebra nada.
 */
export async function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
