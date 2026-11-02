import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  onClick: () => void;
  moduleStatus: string; // active | beta | maintenance | disabled
}

const STORAGE_KEY = "tb_assistant_fab_pos";
const BTN_SIZE = 48; // h-12 w-12 = 48px
const EDGE_GAP = 16; // distância mínima das bordas

/** Lê posição salva no localStorage (falha silenciosamente). */
function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {
    /* ignorado */
  }
  return null;
}

/** Salva posição no localStorage (falha silenciosamente). */
function savePos(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignorado */
  }
}

/** Garante que o botão fique dentro da janela com margem. */
function clamp(pos: { x: number; y: number }): { x: number; y: number } {
  const maxX = window.innerWidth - BTN_SIZE - EDGE_GAP;
  const maxY = window.innerHeight - BTN_SIZE - EDGE_GAP;
  return {
    x: Math.max(EDGE_GAP, Math.min(pos.x, maxX)),
    y: Math.max(EDGE_GAP, Math.min(pos.y, maxY)),
  };
}

/** Posição padrão: canto inferior direito, acima do BottomNav mobile (~72px). */
function defaultPos(): { x: number; y: number } {
  return {
    x: window.innerWidth - BTN_SIZE - EDGE_GAP,
    y: window.innerHeight - BTN_SIZE - EDGE_GAP - 72,
  };
}

export function AssistantButton({ onClick, moduleStatus }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false); // distingue drag de tap
  const startPointer = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Inicializa posição após mount (precisa de window.innerWidth)
  useEffect(() => {
    const saved = loadPos();
    setPos(saved ? clamp(saved) : defaultPos());
  }, []);

  // Reclampa quando a janela é redimensionada
  useEffect(() => {
    function onResize() {
      setPos((prev) => (prev ? clamp(prev) : defaultPos()));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Pointer events (funciona em mouse e touch) ──────────────
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    // Ignora cliques com botão direito
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragging.current = true;
    moved.current = false;
    startPointer.current = { x: e.clientX, y: e.clientY };
    startPos.current = pos ?? defaultPos();
    btnRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return;
    const dx = e.clientX - startPointer.current.x;
    const dy = e.clientY - startPointer.current.y;
    // Só considera "arrasto" após 4px de movimento (evita falso drag em taps)
    if (!moved.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    moved.current = true;
    const next = clamp({ x: startPos.current.x + dx, y: startPos.current.y + dy });
    setPos(next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    btnRef.current?.releasePointerCapture(e.pointerId);

    if (!moved.current) {
      // Foi um tap/clique sem arrasto
      onClick();
      return;
    }

    // Salva posição final
    const final = clamp({
      x: startPos.current.x + (e.clientX - startPointer.current.x),
      y: startPos.current.y + (e.clientY - startPointer.current.y),
    });
    savePos(final);
  }

  if (moduleStatus === "disabled") return null;
  // Aguarda mount para ter a posição calculada (evita flash na posição errada)
  if (pos === null) return null;

  return (
    <button
      ref={btnRef}
      aria-label="Assistente TrailBook"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      // Previne comportamento padrão de touch (scroll, zoom) durante drag
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        touchAction: "none",
        userSelect: "none",
        cursor: moved.current ? "grabbing" : "grab",
        zIndex: 40,
      }}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full shadow-lg",
        "bg-primary text-primary-foreground",
        "transition-shadow hover:shadow-xl active:scale-95",
        // Animação suave ao soltar (mas não durante o drag)
        "duration-150",
      )}
    >
      <Sparkles className="h-5 w-5 pointer-events-none" aria-hidden="true" />
      {moduleStatus === "beta" && (
        <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold leading-none text-black">
          β
        </span>
      )}
    </button>
  );
}
