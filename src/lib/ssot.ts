/**
 * Single Source of Truth (SSOT) — Registro central de origens únicas.
 *
 * Este arquivo NÃO exporta lógica. Ele documenta, em um único lugar, qual
 * módulo é o dono de cada domínio funcional do TrailBook. Toda nova
 * funcionalidade deve consultar esta tabela antes de duplicar catálogos,
 * dados ou formulários.
 *
 * Regra de ouro: se um dado já existe em outro módulo, IMPORTAR do dono.
 * Nunca criar um segundo lugar para manter a mesma informação.
 */

export const SSOT_REGISTRY = {
  /** Marcas e modelos das motos — usados em cadastro, filtros, catálogos. */
  motorcycleCatalog: {
    owner: "src/lib/motorcycle-catalog.ts",
    consumers: ["motorcycles.new", "motorcycles.$id", "admin.users"],
  },
  /** Perfis de uso (normal, esportivo, competição, etc.). */
  useProfiles: {
    owner: "src/lib/plan-templates.ts",
    consumers: ["motorcycles.new", "motorcycles.$id.plan"],
  },
  /** Catálogo de itens/serviços de manutenção (categorias, periodicidades). */
  maintenanceCatalog: {
    owner: "supabase: maintenance_plan_templates + maintenance_plan_items",
    consumers: [
      "motorcycles.$id.plan (aplica plano)",
      "NewEventDialog (Registrar atividade → seleção de item executado)",
      "financial (agrega custos)",
      "dashboard (alertas de vencimento)",
    ],
    rule:
      "Não criar catálogo separado por tipo de evento. Expandir o mesmo catálogo com novas categorias.",
  },
  /** Tipos de eventos exibidos em Registrar atividade. */
  activityEventTypes: {
    owner: "src/lib/trailbook.ts → ACTIVITY_EVENT_TYPES",
    consumers: ["NewEventDialog"],
    rule:
      "Documentos, fotos e vídeos NÃO fazem parte da lista de atividade. Vão para Documentação e Galeria.",
  },
  /** Tipos de documentos permanentes da moto. */
  documentTypes: {
    owner: "src/lib/motorcycle-documents.ts",
    consumers: ["MotorcycleDocuments", "certificate público"],
  },
  /** Fotos da moto (bucket motorcycle-photos + tabela motorcycle_photos). */
  motorcyclePhotos: {
    owner: "src/components/MotorcyclePhotos.tsx",
    consumers: ["motorcycles.$id", "certificate público"],
    rule:
      "main_photo_url em public.motorcycles é sincronizado via trigger sync_primary_photo. Não escrever direto na coluna — sempre marcar via motorcycle_photos.is_primary.",
  },
  /** Planos comerciais e limites. */
  plans: {
    owner: "src/lib/plans.ts",
    consumers: ["usePlan", "motorcycles.new", "plans.tsx"],
  },
  /** Chamados: tipos, módulos, prioridades e status. */
  tickets: {
    owner: "src/lib/tickets.ts",
    consumers: ["tickets*", "admin.tickets"],
  },
  /** Papel administrativo. */
  adminRole: {
    owner: "supabase: user_roles (USER_ADMIN) + is_user_admin(uid)",
    consumers: ["useIsAdmin", "todas as rotinas /admin/*"],
    rule:
      "Nunca condicionar admin por e-mail no código. O papel é sempre lido da tabela user_roles via has_role/is_user_admin.",
  },
} as const;

export type SsotDomain = keyof typeof SSOT_REGISTRY;