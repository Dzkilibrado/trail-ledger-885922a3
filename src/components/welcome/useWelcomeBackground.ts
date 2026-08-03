import { useEffect, useState } from "react";
import { WELCOME_GALLERY, type WelcomeImage } from "./welcome-gallery";

const SESSION_KEY = "tb.welcome.bg";

let memoryPick: string | null = null;

function pickId(): string {
  const stored = memoryPick ?? readSession();
  if (stored && WELCOME_GALLERY.some((i) => i.id === stored)) return stored;
  const chosen = WELCOME_GALLERY[Math.floor(Math.random() * WELCOME_GALLERY.length)].id;
  memoryPick = chosen;
  try {
    sessionStorage.setItem(SESSION_KEY, chosen);
  } catch {
    /* modo privativo: mantém apenas em memória */
  }
  return chosen;
}

function readSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/** Dispositivos modestos ou usuários com movimento reduzido não recebem o efeito. */
function shouldAnimate(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return false;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return false;
  if (nav.connection?.saveData) return false;
  return true;
}

export function useWelcomeBackground(): { image: WelcomeImage | null; animate: boolean } {
  const [image, setImage] = useState<WelcomeImage | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const id = pickId();
    setImage(WELCOME_GALLERY.find((i) => i.id === id) ?? WELCOME_GALLERY[0]);
    setAnimate(shouldAnimate());
  }, []);

  return { image, animate };
}