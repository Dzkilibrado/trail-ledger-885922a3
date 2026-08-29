/**
 * Mapa visual da moto — Entrega 2
 *
 * Ilustração SVG estilizada de moto off-road com grandes regiões
 * interativas. Ao tocar uma região, abre Bottom Sheet com lista de
 * componentes daquela categoria. Alimenta exatamente a mesma estrutura
 * de itens da Entrega 1 (registrar-manutencao.tsx).
 *
 * Alternativa em lista também disponível — mesmo catálogo, sem imagem.
 */

import { useState } from "react";
import { Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory } from "@/lib/trailbook";
import { cn } from "@/lib/utils";
import type { MaintenanceItem } from "./types-registrar";

// ============================================================
// Itens por região (catálogo offline, adaptado ao tipo de moto)
// ============================================================
export const REGION_ITEMS: Record<MaintenanceCategory, { name: string; isPeriodic: boolean }[]> = {
  engine: [
    { name: "Óleo do motor", isPeriodic: true },
    { name: "Filtro de ar", isPeriodic: true },
    { name: "Vela de ignição", isPeriodic: true },
    { name: "Filtro de óleo", isPeriodic: true },
    { name: "Limpeza do carburador", isPeriodic: true },
    { name: "Ajuste do ralenti", isPeriodic: false },
    { name: "Reparo de vazamento", isPeriodic: false },
  ],
  transmission: [
    { name: "Corrente", isPeriodic: true },
    { name: "Kit transmissão (coroa + pinhão)", isPeriodic: true },
    { name: "Coroa", isPeriodic: true },
    { name: "Pinhão", isPeriodic: true },
    { name: "Guia de corrente", isPeriodic: true },
    { name: "Deslizador de corrente", isPeriodic: true },
    { name: "Rolamentos do câmbio", isPeriodic: false },
  ],
  brakes: [
    { name: "Pastilhas dianteiras", isPeriodic: true },
    { name: "Pastilhas traseiras", isPeriodic: true },
    { name: "Fluido de freio", isPeriodic: true },
    { name: "Disco dianteiro", isPeriodic: false },
    { name: "Disco traseiro", isPeriodic: false },
    { name: "Cabo de freio traseiro", isPeriodic: false },
  ],
  suspension: [
    { name: "Óleo do garfo dianteiro", isPeriodic: true },
    { name: "Vedações do garfo", isPeriodic: true },
    { name: "Amortecedor traseiro", isPeriodic: false },
    { name: "Rolamentos da direção", isPeriodic: false },
    { name: "Links (balancim)", isPeriodic: false },
  ],
  wheels: [
    { name: "Pneu dianteiro", isPeriodic: false },
    { name: "Pneu traseiro", isPeriodic: false },
    { name: "Câmara dianteira", isPeriodic: false },
    { name: "Câmara traseira", isPeriodic: false },
    { name: "Aperto dos raios", isPeriodic: true },
    { name: "Rolamento de roda dianteira", isPeriodic: false },
    { name: "Rolamento de roda traseira", isPeriodic: false },
  ],
  electrical: [
    { name: "Vela de ignição", isPeriodic: true },
    { name: "Cabo de vela", isPeriodic: false },
    { name: "Bateria", isPeriodic: false },
    { name: "Regulador/retificador", isPeriodic: false },
    { name: "Chicote elétrico", isPeriodic: false },
    { name: "Interruptores e botões", isPeriodic: false },
  ],
  cooling: [
    { name: "Líquido de arrefecimento", isPeriodic: true },
    { name: "Mangueiras do radiador", isPeriodic: false },
    { name: "Tampão do radiador", isPeriodic: false },
    { name: "Bomba d'água", isPeriodic: false },
  ],
  other: [
    { name: "Guidão", isPeriodic: false },
    { name: "Manetes", isPeriodic: false },
    { name: "Protetor de motor", isPeriodic: false },
    { name: "Plásticos / carenagens", isPeriodic: false },
    { name: "Banco", isPeriodic: false },
    { name: "Suporte de placa", isPeriodic: false },
    { name: "Parafusos estruturais", isPeriodic: false },
  ],
};

const CATEGORY_ICON: Record<MaintenanceCategory, string> = {
  engine: "🔧",
  transmission: "⛓",
  brakes: "🛑",
  suspension: "🔩",
  wheels: "🛞",
  electrical: "⚡",
  cooling: "🌡",
  other: "🔩",
};

// ============================================================
// Tipos
// ============================================================
type Region = {
  id: MaintenanceCategory;
  label: string;
  // path SVG que define a área clicável
  d: string;
  // posição do rótulo visual (cx, cy)
  lx: number;
  ly: number;
};

// ViewBox 400x220 — moto off-road estilizada, flat design
const REGIONS: Region[] = [
  {
    id: "engine",
    label: "Motor",
    // bloco central da moto
    d: "M155 90 L215 90 L220 130 L150 130 Z",
    lx: 185,
    ly: 108,
  },
  {
    id: "transmission",
    label: "Transmissão",
    // lado direito (câmbio/corrente)
    d: "M220 100 L270 100 L270 140 L215 140 Z",
    lx: 244,
    ly: 118,
  },
  {
    id: "brakes",
    label: "Freios",
    // áreas das rodas (frente + trás) — dois retângulos
    d: "M40 135 L90 135 L90 175 L40 175 Z M280 135 L330 135 L330 175 L280 175 Z",
    lx: 65,
    ly: 154,
  },
  {
    id: "suspension",
    label: "Suspensão",
    // garfo dianteiro + amortecedor traseiro
    d: "M95 80 L130 80 L130 145 L95 145 Z M330 80 L360 80 L360 145 L330 145 Z",
    lx: 112,
    ly: 110,
  },
  {
    id: "wheels",
    label: "Rodas / Pneus",
    // rodas em si (círculos como polígonos aproximados)
    d: "M42 148 Q65 125 88 148 Q65 170 42 148 Z M282 148 Q305 125 328 148 Q305 170 282 148 Z",
    lx: 305,
    ly: 148,
  },
  {
    id: "electrical",
    label: "Elétrica",
    // tanque / painel superior
    d: "M155 60 L230 60 L230 88 L155 88 Z",
    lx: 192,
    ly: 73,
  },
  {
    id: "cooling",
    label: "Arrefecimento",
    // radiador (frente da moto, esquerda do motor)
    d: "M120 88 L155 88 L155 130 L120 130 Z",
    lx: 137,
    ly: 108,
  },
  {
    id: "other",
    label: "Estrutura",
    // quadro / plásticos (área superior traseira)
    d: "M230 60 L310 60 L330 85 L280 100 L220 90 Z",
    lx: 270,
    ly: 76,
  },
];

// ============================================================
// SVG da moto — flat design, traços simples
// ============================================================
function MotoSVG({
  activeRegion,
  onRegionClick,
}: {
  activeRegion: MaintenanceCategory | null;
  onRegionClick: (id: MaintenanceCategory) => void;
}) {
  return (
    <svg
      viewBox="0 0 400 220"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      aria-label="Mapa visual da moto — toque numa região para ver os componentes"
    >
      {/* ---- Silhueta base (decorativa, não interativa) ---- */}
      {/* Quadro principal */}
      <path
        d="M130 95 L220 85 L310 65 L330 85 L280 105 L220 100 L160 110 L130 140 L120 130 Z"
        fill="#2a2620"
        stroke="#3a3530"
        strokeWidth="1"
      />
      {/* Roda dianteira */}
      <circle cx="65" cy="155" r="40" fill="none" stroke="#3a3530" strokeWidth="8" />
      <circle cx="65" cy="155" r="26" fill="none" stroke="#2a2620" strokeWidth="4" />
      <circle cx="65" cy="155" r="6" fill="#3a3530" />
      {/* Roda traseira */}
      <circle cx="305" cy="155" r="40" fill="none" stroke="#3a3530" strokeWidth="8" />
      <circle cx="305" cy="155" r="26" fill="none" stroke="#2a2620" strokeWidth="4" />
      <circle cx="305" cy="155" r="6" fill="#3a3530" />
      {/* Garfo dianteiro */}
      <line
        x1="105"
        y1="85"
        x2="70"
        y2="145"
        stroke="#3a3530"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line
        x1="118"
        y1="88"
        x2="82"
        y2="150"
        stroke="#3a3530"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Amortecedor traseiro */}
      <line
        x1="340"
        y1="88"
        x2="320"
        y2="148"
        stroke="#3a3530"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Tanque */}
      <path
        d="M155 62 Q192 55 230 62 L225 90 L160 90 Z"
        fill="#2a2620"
        stroke="#3a3530"
        strokeWidth="1"
      />
      {/* Banco */}
      <path
        d="M230 60 L310 60 L310 72 L230 72 Z"
        rx="4"
        fill="#1e1c18"
        stroke="#3a3530"
        strokeWidth="1"
      />
      {/* Motor (bloco) */}
      <rect
        x="152"
        y="92"
        width="66"
        height="38"
        rx="4"
        fill="#252220"
        stroke="#3a3530"
        strokeWidth="1"
      />
      {/* Radiador */}
      <rect
        x="122"
        y="90"
        width="30"
        height="35"
        rx="2"
        fill="#1e2528"
        stroke="#2a3a3e"
        strokeWidth="1"
      />
      {/* Escape */}
      <path
        d="M155 125 L100 140 L95 155"
        fill="none"
        stroke="#3a3530"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Corrente */}
      <path
        d="M218 128 Q262 138 280 148"
        fill="none"
        stroke="#3a3530"
        strokeWidth="3"
        strokeDasharray="4 3"
      />
      {/* Guidão */}
      <path
        d="M112 78 L95 70 M112 78 L125 70"
        stroke="#3a3530"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* ---- Regiões interativas ---- */}
      {REGIONS.map((region) => {
        const isActive = activeRegion === region.id;
        return (
          <g
            key={region.id}
            onClick={() => onRegionClick(region.id)}
            style={{ cursor: "pointer" }}
            aria-label={region.label}
          >
            <path
              d={region.d}
              fill={isActive ? "rgba(242,101,34,0.35)" : "rgba(242,101,34,0.0)"}
              stroke={isActive ? "#F26522" : "rgba(242,101,34,0.4)"}
              strokeWidth={isActive ? "2" : "1"}
              strokeDasharray={isActive ? "" : "4 3"}
              className="transition-all duration-150"
            />
            {/* Rótulo só aparece no hover/active — não polui a imagem em repouso */}
            {isActive && (
              <text
                x={region.lx}
                y={region.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fontWeight="bold"
                fill="#F26522"
              >
                {region.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Labels discretos sempre visíveis (pequenos, só identificação) */}
      {REGIONS.map(
        (region) =>
          activeRegion !== region.id && (
            <text
              key={`lbl-${region.id}`}
              x={region.lx}
              y={region.ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7"
              fill="rgba(200,190,180,0.5)"
              style={{ pointerEvents: "none" }}
            >
              {region.label.split(" ")[0]}
            </text>
          ),
      )}
    </svg>
  );
}

// ============================================================
// Bottom Sheet de componentes por região
// ============================================================
function RegionSheet({
  category,
  schedules,
  addedItems,
  onAdd,
  onClose,
}: {
  category: MaintenanceCategory;
  schedules: any[];
  addedItems: MaintenanceItem[];
  onAdd: (name: string, scheduleId?: string, templateItemId?: string) => void;
  onClose: () => void;
}) {
  const catalogItems = REGION_ITEMS[category] ?? [];
  const categorySchedules = schedules.filter((s) => s.category === category);

  // Mescla: itens do catálogo base + schedules reais da moto não cobertos pelo catálogo
  const mergedItems = [
    ...catalogItems.map((ci) => {
      const matched = categorySchedules.find((s) =>
        s.name.toLowerCase().includes(ci.name.toLowerCase().split(" ")[0]),
      );
      return { name: ci.name, scheduleId: matched?.id, templateItemId: matched?.template_item_id };
    }),
    ...categorySchedules
      .filter(
        (s) =>
          !catalogItems.some((ci) =>
            s.name.toLowerCase().includes(ci.name.toLowerCase().split(" ")[0]),
          ),
      )
      .map((s) => ({ name: s.name, scheduleId: s.id, templateItemId: s.template_item_id })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl border-t border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted-foreground/30" />

        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{CATEGORY_ICON[category]}</span>
            <h3 className="font-display font-bold text-lg">{MAINT_CATEGORY_LABEL[category]}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-4 pb-6 space-y-1">
          {mergedItems.map((item) => {
            const alreadyAdded = addedItems.some(
              (it) =>
                it.service === item.name || (item.scheduleId && it.scheduleId === item.scheduleId),
            );
            return (
              <button
                key={item.name}
                onClick={() => {
                  if (!alreadyAdded) {
                    onAdd(item.name, item.scheduleId, item.templateItemId);
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition",
                  alreadyAdded
                    ? "border-primary/30 bg-primary/5 opacity-70"
                    : "border-border bg-card hover:border-primary/50 active:scale-[0.98]",
                )}
              >
                <span className="text-sm font-medium">{item.name}</span>
                {alreadyAdded ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            );
          })}

          {mergedItems.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum componente catalogado para esta região.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Componente principal exportado
// ============================================================
export function MotoMap({
  schedules,
  addedItems,
  onAdd,
}: {
  schedules: any[];
  addedItems: MaintenanceItem[];
  onAdd: (
    name: string,
    category: MaintenanceCategory,
    scheduleId?: string,
    templateItemId?: string,
  ) => void;
}) {
  const [activeRegion, setActiveRegion] = useState<MaintenanceCategory | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  function handleAdd(name: string, scheduleId?: string, templateItemId?: string) {
    if (!activeRegion) return;
    onAdd(name, activeRegion, scheduleId, templateItemId);
  }

  return (
    <div className="space-y-3">
      {/* Toggle mapa / lista */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        <button
          onClick={() => setViewMode("map")}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-xs font-semibold transition",
            viewMode === "map"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          🏍 Mapa visual
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-xs font-semibold transition",
            viewMode === "list"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          📋 Ver categorias
        </button>
      </div>

      {viewMode === "map" ? (
        <div className="rounded-2xl border border-border bg-card/60 p-3">
          <p className="mb-2 text-center text-[11px] text-muted-foreground">
            Toque numa região para ver os componentes
          </p>
          <MotoSVG activeRegion={activeRegion} onRegionClick={(id) => setActiveRegion(id)} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(MAINT_CATEGORY_LABEL) as MaintenanceCategory[]).map((cat) => {
            const count = (REGION_ITEMS[cat] ?? []).length;
            const added = addedItems.filter((it) => it.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveRegion(cat)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border py-4 transition",
                  added > 0
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                <span className="text-2xl">{CATEGORY_ICON[cat]}</span>
                <span className="text-xs font-semibold">{MAINT_CATEGORY_LABEL[cat]}</span>
                {added > 0 && (
                  <span className="text-[10px] text-primary font-bold">
                    {added} adicionado{added > 1 ? "s" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom Sheet */}
      {activeRegion && (
        <RegionSheet
          category={activeRegion}
          schedules={schedules}
          addedItems={addedItems}
          onAdd={handleAdd}
          onClose={() => setActiveRegion(null)}
        />
      )}
    </div>
  );
}
