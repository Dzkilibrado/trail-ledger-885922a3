import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 70;

/**
 * Puxar-para-atualizar no estilo nativo (Instagram/WhatsApp). Só reage a
 * gestos de toque começando no topo absoluto da página — nunca interfere
 * com rolagem normal em nenhum ponto do app. Ao soltar além do limiar,
 * refaz todas as buscas ativas da tela atual (React Query).
 *
 * Ativo só no mobile — em telas maiores não há gesto de toque, então o
 * indicador visual fica escondido (mas os listeners são inofensivos).
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshingRef.current) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    }
    function onTouchMove(e: TouchEvent) {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY === 0) {
        const next = Math.min(dy * 0.5, 100);
        pullRef.current = next;
        setPull(next);
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    }
    async function onTouchEnd() {
      if (startY.current == null) return;
      startY.current = null;
      if (pullRef.current > THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await qc.refetchQueries({ type: "active" });
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
        }
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [qc]);

  const showIndicator = pull > 8 || refreshing;
  const armed = pull >= THRESHOLD || refreshing;

  return (
    <>
      <div
        className="flex items-center justify-center overflow-hidden md:hidden"
        style={{
          height: refreshing ? THRESHOLD : pull,
          transition: pull === 0 && !refreshing ? "height 0.2s ease-out" : undefined,
        }}
        aria-hidden={!showIndicator}
      >
        {showIndicator && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className={cn("h-4 w-4", (refreshing || armed) && "animate-spin")} />
            {refreshing ? "Atualizando…" : armed ? "Solte para atualizar" : "Puxe para atualizar"}
          </div>
        )}
      </div>
      {children}
    </>
  );
}
