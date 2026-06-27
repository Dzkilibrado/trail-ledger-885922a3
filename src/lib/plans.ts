import type { Database } from "@/integrations/supabase/types";

export type PlanTier = "free" | "premium" | "workshop";

export interface PlanDef {
  tier: PlanTier;
  label: string;
  tagline: string;
  priceLabel: string;
  highlight?: boolean;
  features: string[];
  limits: {
    motorcycles: number;          // -1 = ilimitado
    activeCertificates: number;   // -1 = ilimitado
    attachmentsPerEvent: number;  // -1 = ilimitado
    pdfExport: boolean;
    workshopBranding: boolean;
    verifiedBadge: boolean;
  };
}

export const PLANS: Record<PlanTier, PlanDef> = {
  free: {
    tier: "free",
    label: "Free",
    tagline: "Para começar o histórico da sua moto",
    priceLabel: "Grátis",
    features: [
      "1 moto cadastrada",
      "Linha do tempo completa",
      "Agenda inteligente",
      "Índice de Conservação",
      "1 certificado público ativo",
    ],
    limits: {
      motorcycles: 1,
      activeCertificates: 1,
      attachmentsPerEvent: 3,
      pdfExport: false,
      workshopBranding: false,
      verifiedBadge: false,
    },
  },
  premium: {
    tier: "premium",
    label: "Premium",
    tagline: "Para quem cuida de várias motos",
    priceLabel: "Em breve",
    highlight: true,
    features: [
      "Motos ilimitadas",
      "Certificados ilimitados",
      "Exportação em PDF do laudo",
      "Anexos ilimitados por evento",
      "Prioridade no suporte",
    ],
    limits: {
      motorcycles: -1,
      activeCertificates: -1,
      attachmentsPerEvent: -1,
      pdfExport: true,
      workshopBranding: false,
      verifiedBadge: false,
    },
  },
  workshop: {
    tier: "workshop",
    label: "Oficina",
    tagline: "Para oficinas certificadas",
    priceLabel: "Em breve",
    features: [
      "Tudo do Premium",
      "Selo TrailBook Verified",
      "Registro como oficina parceira",
      "Branding nos certificados emitidos",
      "Painel multi-cliente (em breve)",
    ],
    limits: {
      motorcycles: -1,
      activeCertificates: -1,
      attachmentsPerEvent: -1,
      pdfExport: true,
      workshopBranding: true,
      verifiedBadge: true,
    },
  },
};

export type PlanProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "plan" | "plan_since"
>;

export function planOf(profile: PlanProfile | null | undefined): PlanDef {
  const tier = (profile?.plan as PlanTier | undefined) ?? "free";
  return PLANS[tier] ?? PLANS.free;
}

export function canCreateMotorcycle(plan: PlanDef, currentCount: number): boolean {
  return plan.limits.motorcycles === -1 || currentCount < plan.limits.motorcycles;
}

export function canCreateCertificate(plan: PlanDef, activeCount: number): boolean {
  return plan.limits.activeCertificates === -1 || activeCount < plan.limits.activeCertificates;
}

export function limitLabel(n: number): string {
  return n === -1 ? "ilimitado" : String(n);
}