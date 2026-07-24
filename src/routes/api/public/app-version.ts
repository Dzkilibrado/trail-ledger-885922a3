import { createFileRoute } from "@tanstack/react-router";
import { APP_VERSION, BUILD_AT, BUILD_ID } from "@/lib/version/build-info";

// Endpoint público de versão (Solução Mínima — v1.7).
// Reflete exatamente a build que atende a requisição — mesmos valores
// injetados no bundle do frontend (`vite.config.ts` -> define).
// Cabeçalhos garantem que CDN/navegador NUNCA sirvam uma resposta antiga.
const NO_CACHE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-cache, no-store, must-revalidate, max-age=0",
  pragma: "no-cache",
  expires: "0",
};

export const Route = createFileRoute("/api/public/app-version")({
  server: {
    handlers: {
      GET: async () => {
        const payload = {
          currentVersion: APP_VERSION,
          buildId: BUILD_ID,
          publishedAt: BUILD_AT,
          // Mensagem curta e amigável (opcional). Sem HTML, sem changelog longo.
          releaseMessage: process.env.TB_RELEASE_MESSAGE?.trim() || null,
          // Preparado para fase futura — inativo nesta fase.
          minimumSupportedVersion: null,
          forceUpdate: false,
          requiresReauthentication: false,
        };
        return new Response(JSON.stringify(payload), { status: 200, headers: NO_CACHE_HEADERS });
      },
    },
  },
});