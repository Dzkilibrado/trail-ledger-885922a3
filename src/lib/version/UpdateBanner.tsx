import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { useVersionState, isUserInactive } from "./useVersionWatcher";
import { canReloadNow, performReload } from "./reload";
import { canAttemptReloadTo, loopDetectedFor } from "./service";
import { LOCAL_BUILD } from "./build-info";
import { cn } from "@/lib/utils";

const SNOOZE_MS = 30 * 60_000;

export function UpdateBanner() {
  const state = useVersionState();
  const qc = useQueryClient();
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [reloading, setReloading] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const autoTriedForRef = useRef<string | null>(null);

  const remote = state.remote;
  const showable =
    state.updateAvailable &&
    remote &&
    remote.buildId !== LOCAL_BUILD.buildId &&
    Date.now() > snoozedUntil;

  // Auto-reload discreto quando o usuário está inativo e nada crítico acontece.
  useEffect(() => {
    if (!showable || !remote) return;
    if (autoTriedForRef.current === remote.buildId) return;
    if (!isUserInactive(2 * 60_000)) return;
    const block = canReloadNow(qc);
    if (!block.ok) return;
    if (!canAttemptReloadTo(remote.buildId)) return;
    autoTriedForRef.current = remote.buildId;
    const t = window.setTimeout(() => {
      const still = canReloadNow(qc);
      if (still.ok && isUserInactive(2 * 60_000)) {
        performReload(remote.buildId);
      }
    }, 2_500);
    return () => window.clearTimeout(t);
  }, [showable, remote, qc, reloading]);

  if (!showable || !remote) return null;

  const inLoop = loopDetectedFor(remote.buildId);

  const doUpdate = () => {
    if (reloading) return;
    setReloading(1);
    const block = canReloadNow(qc);
    if (!block.ok) {
      if (block.reason === "mutating") {
        setMessage("Aguarde: uma gravação está em andamento. A atualização acontece assim que terminar.");
        // Reagenda quando o número de mutations cair a zero.
        const iv = window.setInterval(() => {
          const b = canReloadNow(qc);
          if (b.ok) {
            window.clearInterval(iv);
            performReload(remote.buildId);
          }
        }, 1_000);
        return;
      }
      if (block.reason === "dirty") {
        setMessage("Você tem alterações não salvas. Salve ou descarte antes de atualizar.");
        setReloading(0);
        return;
      }
      if (block.reason === "offline") {
        setMessage("Sem conexão no momento. Conecte-se e tente novamente.");
        setReloading(0);
        return;
      }
    }
    if (!canAttemptReloadTo(remote.buildId)) {
      setMessage("Não foi possível concluir a atualização automaticamente. Tente novamente em alguns instantes.");
      setReloading(0);
      return;
    }
    performReload(remote.buildId);
  };

  const doLater = () => setSnoozedUntil(Date.now() + SNOOZE_MS);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-3",
        // Acima da tab-bar mobile / safe-area iOS.
        "bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6",
      )}
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-foreground">Nova versão disponível</div>
              <button
                onClick={doLater}
                aria-label="Fechar aviso de atualização"
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              O TrailBook recebeu melhorias. Atualize para utilizar a versão mais recente.
            </p>
            {remote.releaseMessage && (
              <p className="mt-1 text-xs text-muted-foreground/90 line-clamp-3">
                {remote.releaseMessage}
              </p>
            )}
            {(message || inLoop) && (
              <p className="mt-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs text-foreground">
                {inLoop
                  ? "Não foi possível concluir a atualização automaticamente. Tente novamente em alguns instantes."
                  : message}
              </p>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                onClick={doLater}
                className="inline-flex items-center rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                Depois
              </button>
              <button
                onClick={doUpdate}
                disabled={reloading > 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", reloading > 0 && "animate-spin")} />
                {reloading > 0 ? "Atualizando…" : "Atualizar agora"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
