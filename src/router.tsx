import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Defaults sensatos para o TrailBook (Sprint v1.6 — polimento):
  //  - staleTime 30s: dashboards e listas não refazem fetch a cada foco.
  //  - gcTime 5min: mantém cache "quente" quando o usuário volta pra tela.
  //  - retry 1: erros de rede tentam mais uma vez, sem loops longos.
  //  - refetchOnWindowFocus false: menos jitter em Mobile.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
