import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import type { SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightLeft,
  Check,
  X,
  Inbox,
  ShieldCheck,
  FileSignature,
  ChevronRight,
  Bike,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/trailbook";
import { PageHeader } from "@/components/PageHeader";
import { TONE } from "@/lib/ui/status-styles";
import { invalidateMotorcycleState } from "@/hooks/useActiveMotorcycle";
import { listUserProcesses, type ProcessItem, type ProcessBucket } from "@/lib/transfers.functions";
import { StoragePhoto } from "@/components/StoragePhoto";
import { cn } from "@/lib/utils";

type SearchParams = {
  filter?: FilterKey;
  role?: RoleKey;
  type?: TypeKey;
  receipt?: string;
  invite?: string;
};
type FilterKey = "all" | "awaiting_me" | "in_progress" | "completed" | "cancelled";
type RoleKey = "all" | "buying" | "selling";
type TypeKey = "all" | "receipt" | "invite";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "awaiting_me", label: "Aguardando você" },
  { key: "in_progress", label: "Em andamento" },
  { key: "completed", label: "Concluídos" },
  { key: "cancelled", label: "Cancelados" },
  { key: "all", label: "Todos" },
];
const ROLE_OPTIONS: { key: RoleKey; label: string }[] = [
  { key: "all", label: "Compras e vendas" },
  { key: "selling", label: "Vendas" },
  { key: "buying", label: "Compras" },
];
const TYPE_OPTIONS: { key: TypeKey; label: string }[] = [
  { key: "all", label: "Todos os tipos" },
  { key: "receipt", label: "Compra e Venda" },
  { key: "invite", label: "Transferência por convite" },
];

const BUCKET_TONE: Record<ProcessBucket, string> = {
  awaiting_me: TONE.amber,
  in_progress: TONE.sky,
  completed: TONE.emerald,
  cancelled: TONE.muted,
};

export const Route = createFileRoute("/_authenticated/transfers")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    filter: normalizeFilter(search.filter),
    role: normalizeRole(search.role),
    type: normalizeType(search.type),
    receipt: typeof search.receipt === "string" ? search.receipt : undefined,
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Central de Transferências — TrailBook" },
      { name: "description", content: "Acompanhe compras, vendas e transferências das suas motocicletas em um único lugar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TransfersPage,
});

function normalizeFilter(v: unknown): FilterKey {
  return v === "awaiting_me" || v === "in_progress" || v === "completed" || v === "cancelled" ? v : "all";
}
function normalizeRole(v: unknown): RoleKey {
  return v === "buying" || v === "selling" ? v : "all";
}
function normalizeType(v: unknown): TypeKey {
  return v === "receipt" || v === "invite" ? v : "all";
}

const STATUS_TONE: Record<string, string> = {
  pending: TONE.amber,
  approved: TONE.emerald,
  rejected: TONE.destructive,
  cancelled: TONE.muted,
};
const STATUS_LABEL: Record<string, string> = { pending: "Pendente", approved: "Aprovada", rejected: "Recusada", cancelled: "Cancelada" };

function TransfersPage() {
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/transfers" });
  const search = Route.useSearch();
  const listFn = useServerFn(listUserProcesses);
  const highlightRef = useRef<HTMLLIElement | null>(null);

  const processes = useQuery({
    queryKey: ["user-processes"],
    queryFn: () => listFn(),
    staleTime: 20_000,
  });

  const items = processes.data ?? [];

  // Filtragem client-side (backend já respeitou RLS).
  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (search.filter && search.filter !== "all" && it.status_bucket !== search.filter) return false;
      if (search.role === "selling" && it.role !== "seller") return false;
      if (search.role === "buying" && it.role !== "buyer") return false;
      if (search.type && search.type !== "all" && it.type !== search.type) return false;
      return true;
    });
  }, [items, search.filter, search.role, search.type]);

  // Contexto destacado por `?receipt=` ou `?invite=`.
  const highlightedKey = useMemo(() => {
    if (search.receipt) {
      const it = items.find((i) => i.type === "receipt" && i.receipt_code === search.receipt);
      return it?.key ?? null;
    }
    if (search.invite) {
      const it = items.find((i) => i.type === "invite" && i.id === search.invite);
      return it?.key ?? null;
    }
    return null;
  }, [items, search.receipt, search.invite]);

  useEffect(() => {
    if (highlightedKey && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedKey]);

  // Se o usuário chegou com ?receipt=<code> e o processo não existe, avisar sem tela vazia.
  useEffect(() => {
    if (!processes.isSuccess) return;
    if (search.receipt && !items.some((i) => i.receipt_code === search.receipt)) {
      toast.info(`Nenhum processo encontrado para o recibo ${search.receipt}.`);
    }
    if (search.invite && !items.some((i) => i.type === "invite" && i.id === search.invite)) {
      toast.info("Convite não encontrado ou já resolvido.");
    }
  }, [processes.isSuccess, items, search.receipt, search.invite]);

  function setFilter(key: FilterKey) {
    navigate({ search: ((prev: SearchParams) => ({ ...prev, filter: key })) as SetStateAction<SearchParams>, replace: true });
  }
  function setRole(key: RoleKey) {
    navigate({ search: ((prev: SearchParams) => ({ ...prev, role: key })) as SetStateAction<SearchParams>, replace: true });
  }
  function setType(key: TypeKey) {
    navigate({ search: ((prev: SearchParams) => ({ ...prev, type: key })) as SetStateAction<SearchParams>, replace: true });
  }

  async function respondInvite(id: string, approve: boolean) {
    const { error } = await supabase.rpc("respond_ownership_transfer", {
      _transfer_id: id,
      _approve: approve,
    } as never);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Transferência aprovada" : "Transferência recusada");
    qc.invalidateQueries({ queryKey: ["user-processes"] });
    qc.invalidateQueries({ queryKey: ["transfers"] });
    await invalidateMotorcycleState(qc);
  }
  async function cancelInvite(id: string) {
    const { error } = await supabase.rpc("cancel_ownership_transfer", {
      _transfer_id: id,
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Solicitação cancelada");
    qc.invalidateQueries({ queryKey: ["user-processes"] });
    qc.invalidateQueries({ queryKey: ["transfers"] });
  }

  const activeFilter: FilterKey = search.filter ?? "all";
  const activeRole: RoleKey = search.role ?? "all";
  const activeType: TypeKey = search.type ?? "all";
  const showEmpty = processes.isSuccess && filtered.length === 0;
  const totalCompleted = items.filter((i) => i.status_bucket === "completed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Transferências"
        description="Compras, vendas e transferências das suas motos em um só lugar."
      />

      {/* Filtros */}
      <div className="space-y-2">
        <FilterRow>
          {FILTER_OPTIONS.map((f) => (
            <FilterChip key={f.key} active={activeFilter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow>
          {ROLE_OPTIONS.map((r) => (
            <FilterChip key={r.key} active={activeRole === r.key} onClick={() => setRole(r.key)}>
              {r.label}
            </FilterChip>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 self-center bg-border" aria-hidden />
          {TYPE_OPTIONS.map((t) => (
            <FilterChip key={t.key} active={activeType === t.key} onClick={() => setType(t.key)} tone="subtle">
              {t.label}
            </FilterChip>
          ))}
        </FilterRow>
      </div>

      {/* Lista */}
      {processes.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card/40" />
          ))}
        </div>
      ) : showEmpty ? (
        <EmptyState
          activeFilter={activeFilter}
          totalCompleted={totalCompleted}
          hasAny={items.length > 0}
          onShowCompleted={() => setFilter("completed")}
          onShowAll={() => setFilter("all")}
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((it) => (
            <li key={it.key} ref={it.key === highlightedKey ? highlightRef : undefined}>
              <ProcessCard
                item={it}
                highlighted={it.key === highlightedKey}
                onRespond={respondInvite}
                onCancel={cancelInvite}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="surface-elevated rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <ShieldCheck className="mb-1 inline h-3.5 w-3.5 text-primary" /> O TrailBook ID e o histórico permanecem vinculados à motocicleta — não ao proprietário. A troca de propriedade só é efetivada após todas as validações previstas.
      </div>
    </div>
  );
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  tone = "primary",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "primary" | "subtle";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px]",
        active
          ? tone === "primary"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-foreground bg-foreground text-background"
          : "border-border bg-card/40 text-muted-foreground hover:bg-card",
      )}
    >
      {children}
    </button>
  );
}

function ProcessCard({
  item,
  highlighted,
  onRespond,
  onCancel,
}: {
  item: ProcessItem;
  highlighted: boolean;
  onRespond: (id: string, approve: boolean) => void;
  onCancel: (id: string) => void;
}) {
  const navigate = useNavigate();
  const isInvite = item.type === "invite";
  const canContinueViaViewer = item.type === "receipt" && item.receipt_code
    && item.detail_url.startsWith("/recibos/");

  function openDetail() {
    if (canContinueViaViewer && item.receipt_code) {
      const variant = item.status === "completed" ? "signed" : "original";
      navigate({
        to: "/recibos/$code/visualizar",
        params: { code: item.receipt_code },
        search: { variant, from: "/transfers" },
      });
      return;
    }
    if (item.detail_url.startsWith("/motorcycles/")) {
      navigate({
        to: "/motorcycles/$id/control",
        params: { id: item.motorcycle_id },
      });
      return;
    }
    // Invite ou detalhes locais: nada — a ação está inline no card.
  }

  const TypeIcon = isInvite ? ArrowRightLeft : FileSignature;

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card/40 p-3 transition-colors sm:p-4",
        highlighted
          ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
          : "border-border",
      )}
    >
      <div className="flex gap-3">
        {/* Foto da moto */}
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-muted-foreground sm:h-16 sm:w-16">
          {item.motorcycle_photo ? (
            <StoragePhoto
              bucket="motorcycles"
              path={item.motorcycle_photo}
              alt={item.motorcycle_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Bike className="h-6 w-6" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <TypeIcon className="h-3 w-3" /> {item.type_label}
            </span>
            <Badge variant="outline" className={BUCKET_TONE[item.status_bucket]}>
              {item.display_status}
            </Badge>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate font-semibold text-foreground">{item.motorcycle_name}</span>
            {item.trailbook_id && (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {item.trailbook_id}
              </code>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{item.role_label}</span>
            {item.counterparty_name && (
              <>
                <span aria-hidden>•</span>
                <span className="truncate max-w-[220px]">{item.counterparty_name}</span>
              </>
            )}
            {item.receipt_code && (
              <>
                <span aria-hidden>•</span>
                <code className="font-mono text-[10px]">{item.receipt_code}</code>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>Iniciado {formatDate(item.started_at)}</span>
            {item.updated_at !== item.started_at && (
              <>
                <span aria-hidden>•</span>
                <span>Atualizado {formatDate(item.updated_at)}</span>
              </>
            )}
          </div>

          {item.action_owner_label && (
            <div
              className={cn(
                "text-xs font-medium",
                item.requires_user_action ? "text-amber-400" : "text-muted-foreground",
              )}
            >
              {item.action_owner_label}
            </div>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
        {isInvite && item.status === "pending" && item.role === "buyer" && (
          <>
            <Button size="sm" variant="outline" onClick={() => onRespond(item.id, false)}>
              <X className="h-4 w-4" /> Recusar
            </Button>
            <Button size="sm" onClick={() => onRespond(item.id, true)}>
              <Check className="h-4 w-4" /> Aprovar
            </Button>
          </>
        )}
        {isInvite && item.status === "pending" && item.role === "seller" && (
          <>
            <span className="mr-auto inline-flex items-center gap-1 text-xs text-amber-400">
              <Mail className="h-3 w-3" /> Aguardando resposta do destinatário
            </span>
            <Button size="sm" variant="outline" onClick={() => onCancel(item.id)}>
              <X className="h-4 w-4" /> Cancelar
            </Button>
          </>
        )}
        {!isInvite && item.next_action_label && (
          <Button size="sm" onClick={openDetail}>
            {item.next_action_label}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </article>
  );
}

function EmptyState({
  activeFilter,
  hasAny,
  totalCompleted,
  onShowCompleted,
  onShowAll,
}: {
  activeFilter: FilterKey;
  hasAny: boolean;
  totalCompleted: number;
  onShowCompleted: () => void;
  onShowAll: () => void;
}) {
  const isFiltered = activeFilter !== "all";
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/20 p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Inbox className="h-5 w-5" />
      </div>
      <h2 className="mt-3 font-display text-lg font-bold">Nenhuma transferência em andamento.</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Os processos de compra e venda iniciados por você, ou enviados para sua aprovação, aparecerão aqui.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {isFiltered && hasAny && (
          <Button size="sm" variant="outline" onClick={onShowAll}>Ver todos</Button>
        )}
        {isFiltered && totalCompleted > 0 && activeFilter !== "completed" && (
          <Button size="sm" variant="outline" onClick={onShowCompleted}>
            Ver concluídos ({totalCompleted})
          </Button>
        )}
      </div>
    </div>
  );
}