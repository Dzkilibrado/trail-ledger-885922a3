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
    owner: "supabase: maintenance_plan_templates + maintenance_plan_items (lido via src/lib/maintenance-catalog.ts)",
    consumers: [
      "motorcycles.$id.plan (aplica plano)",
      "NewEventDialog (Registrar atividade → seleção de item executado)",
      "PlanCatalogSyncDialog (adiciona novos itens do catálogo a planos existentes)",
      "financial (agrega custos)",
      "dashboard (alertas de vencimento)",
    ],
    rule:
      "Não criar catálogo separado por tipo de evento. Expandir o mesmo catálogo com novas categorias. Toda leitura de catálogo passa por src/lib/maintenance-catalog.ts.",
    linking:
      "Schedules e maintenance_items carregam template_item_id (FK → maintenance_plan_items). Registrar atividade prefere esse vínculo; nome é apenas fallback. Isso torna o vínculo imune a renomeações do usuário.",
  },
  /** Tipos de eventos exibidos em Registrar atividade. */
  activityEventTypes: {
    owner: "src/lib/trailbook.ts → ACTIVITY_EVENT_TYPES",
    consumers: ["NewEventDialog"],
    rule:
      "Documentos, fotos e vídeos NÃO fazem parte da lista de atividade. Vão para Documentação e Galeria.",
    futureMigration:
      "Metadados de sinistro (incident_type, severity) e uso (usage_kind, riders, conditions) ficam em events.description prefixados por tag ('Ocorrência: …'). Migração futura: promover para colunas dedicadas em events ou tabela event_metadata; código atual já isola a montagem dos meta[] no NewEventDialog para facilitar essa evolução.",
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
  /**
   * Passaporte Digital da Motocicleta — agregador SSOT.
   * Não persiste dados próprios: consome os módulos abaixo e devolve a
   * visão consolidada (timeline, saúde, selo, pendências).
   */
  passport: {
    owner: "src/lib/passport.ts (+ rota /motorcycles/$id/passport)",
    consumers: ["motorcycles.$id.passport"],
    sources: [
      "motorcycles (identidade, foto principal, km/h)",
      "events (histórico funcional)",
      "motorcycle_documents (documentos permanentes)",
      "motorcycle_photos (galeria)",
      "ownership_history (proprietários)",
      "certificates (compartilhamentos emitidos)",
      "maintenance_schedules + priorityList (pendências críticas)",
      "workshops (nomes para timeline)",
    ],
    rule:
      "PROIBIDO criar tabelas paralelas para score/selo enquanto o cálculo puder ser derivado das fontes acima. Snapshots congelados (ex.: certificate emitido) podem persistir a tier em coluna dedicada em certificates, mas nunca substituem o cálculo em tempo real do passaporte.",
    extensionPoints:
      "Ver comentários EXT: no arquivo — TrailBook Score, valorização, IA, compartilhamento por audiência e log de acessos.",
  },
} as const;

export type SsotDomain = keyof typeof SSOT_REGISTRY;