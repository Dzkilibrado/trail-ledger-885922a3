import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileWarning, ChevronRight, Paperclip } from "lucide-react";
import { useDocumentPendencies } from "@/hooks/useDocumentPendencies";
import { findOrigin } from "@/lib/motorcycle-origin";
import { isOriginSnoozed } from "@/lib/origin-status";
import { supabase } from "@/integrations/supabase/client";

/**
 * Card do Dashboard: Pendências Documentais.
 * Só renderiza quando há pelo menos uma moto com pendência de documento
 * de origem. Nunca bloqueia — apenas convida a resolver.
 */
export function DocumentPendenciesCard() {
  const q = useDocumentPendencies();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);
  const rawRows = q.data ?? [];
  // Respeita o "Lembrar mais tarde" (silêncio local por 7 dias, por usuário + moto).
  const rows = rawRows.filter((r) => !isOriginSnoozed(uid, r.motorcycle_id));
  if (q.isLoading || rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
      <header className="mb-3 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
          <FileWarning className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-amber-100">🟠 Documento de origem pendente</h2>
          <p className="text-xs text-amber-200/70">
            {rows.length === 1
              ? "1 moto ainda sem Nota Fiscal ou Recibo de Compra e Venda anexado."
              : `${rows.length} motos ainda sem Nota Fiscal ou Recibo de Compra e Venda anexado.`}
          </p>
        </div>
      </header>
      <ul className="space-y-2">
        {rows.slice(0, 4).map((r) => {
          const originInfo = findOrigin(r.origin_type);
          const label =
            r.nickname ||
            [r.brand, r.model].filter(Boolean).join(" ") ||
            "Motocicleta";
          return (
            <li key={r.motorcycle_id}>
              <Link
                to="/documents/$id"
                params={{ id: r.motorcycle_id }}
                search={{ kind: "origin" }}
                className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-background/40 p-3 transition hover:border-amber-400/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    ⚠ {label}
                    {r.year_model ? (
                      <span className="text-muted-foreground"> · {r.year_model}</span>
                    ) : null}
                  </div>
                  <div className="truncate text-[11px] text-amber-200/70">
                    {originInfo ? `${originInfo.short} · ` : ""}
                    Nota Fiscal ou Recibo de Compra e Venda
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-[11px] font-semibold text-amber-950">
                  <Paperclip className="h-3 w-3" /> Anexar
                </span>
                <ChevronRight className="h-4 w-4 text-amber-300/60" />
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length > 4 && (
        <p className="mt-2 text-[11px] text-amber-200/70">
          + {rows.length - 4} outras motos com pendência.
        </p>
      )}
    </section>
  );
}