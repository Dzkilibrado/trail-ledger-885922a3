// Constantes injetadas pelo Vite (`vite.config.ts` -> `define`).
// Se por algum motivo não forem substituídas (ambiente exótico), caímos em
// valores neutros que não quebram nada e evitam falso positivo de atualização.
declare const __TB_APP_VERSION__: string;
declare const __TB_BUILD_ID__: string;
declare const __TB_BUILD_AT__: string;

export const APP_VERSION: string =
  typeof __TB_APP_VERSION__ !== "undefined" ? __TB_APP_VERSION__ : "dev";
export const BUILD_ID: string =
  typeof __TB_BUILD_ID__ !== "undefined" ? __TB_BUILD_ID__ : "dev";
export const BUILD_AT: string =
  typeof __TB_BUILD_AT__ !== "undefined" ? __TB_BUILD_AT__ : new Date(0).toISOString();

export const LOCAL_BUILD = {
  appVersion: APP_VERSION,
  buildId: BUILD_ID,
  publishedAt: BUILD_AT,
} as const;

export type BuildInfo = typeof LOCAL_BUILD;

export function shortBuildId(id: string = BUILD_ID): string {
  return id.length > 12 ? id.slice(-8) : id;
}