// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Build identifiers (Solução Mínima de Controle de Versão — v1.7).
// - APP_VERSION vem de package.json (funcional, legível).
// - BUILD_ID é único por publicação (commit + timestamp, ou timestamp+rand).
// Ambos são resolvidos UMA vez aqui e substituídos no bundle (frontend e SSR
// carregam exatamente o mesmo valor da mesma build).
import pkg from "./package.json" with { type: "json" };

const commitSha =
  process.env.LOVABLE_COMMIT_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "";
const shortSha = commitSha ? commitSha.slice(0, 7) : Math.random().toString(36).slice(2, 9);
const buildAt = new Date();
const stamp =
  buildAt.getUTCFullYear().toString() +
  String(buildAt.getUTCMonth() + 1).padStart(2, "0") +
  String(buildAt.getUTCDate()).padStart(2, "0") +
  "-" +
  String(buildAt.getUTCHours()).padStart(2, "0") +
  String(buildAt.getUTCMinutes()).padStart(2, "0") +
  String(buildAt.getUTCSeconds()).padStart(2, "0");
const BUILD_ID = `${stamp}-${shortSha}`;
const APP_VERSION = (pkg as { version?: string }).version ?? "0.0.0";
const BUILD_AT = buildAt.toISOString();

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      __TB_APP_VERSION__: JSON.stringify(APP_VERSION),
      __TB_BUILD_ID__: JSON.stringify(BUILD_ID),
      __TB_BUILD_AT__: JSON.stringify(BUILD_AT),
    },
  },
});
