// ============================================================
// AssistantDrawer — Bottom sheet mobile-first do Assistente TrailBook
// Navegação: home → topics → topic-detail → article | search
//
// COBERTURA COMPLETA: todos os menus, rotas e ações do sistema
// estão mapeados aqui — atalhos, trilhas e guias passo a passo.
// ============================================================

import { useRef, useEffect, useState } from "react";
import {
  X, Search, ArrowLeft, ChevronRight, LifeBuoy, Layers,
  Bike, Wrench, FileCheck, HeartPulse, BadgeCheck, ShieldCheck,
  User, Calendar, Banknote, Home, Zap, MapPin, BookOpen,
  LayoutDashboard, ClipboardList, FileText, Settings2,
  Bell, MessageSquare, HelpCircle, CreditCard, PenLine,
  Share2, ScrollText, Store, ReceiptText, ArrowRightLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { useAssistant, TopicGroup } from "@/hooks/useAssistant";
import type { AssistantContext } from "@/lib/assistant-context";
import type { HelpArticle } from "@/lib/assistant-search";

type AssistantState = ReturnType<typeof useAssistant>;

// Mapa de ícones Lucide por nome (mesmo config do hook)
const ICON_MAP: Record<string, React.ElementType> = {
  Bike, Wrench, FileCheck, HeartPulse, BadgeCheck, ShieldCheck,
  User, Calendar, Banknote, LifeBuoy,
};

// ─────────────────────────────────────────────────────────────
// MAPA COMPLETO DE DESTINOS DO TRAILBOOK
// Cada entrada = uma funcionalidade real do sistema
// path[] = trilha de navegação que o usuário precisa seguir
// ─────────────────────────────────────────────────────────────

interface Destination {
  key: string;
  emoji: string;
  label: string;            // rótulo curto para atalhos/chips
  description: string;      // descrição para guias e sugestões
  path: string[];           // trilha de navegação visual
  route?: string;           // rota estática
  routeTemplate?: string;   // rota com $motorcycleId
  needsMoto?: boolean;
  category: DestCategory;
}

type DestCategory =
  | "moto-painel"
  | "moto-lancamentos"
  | "moto-checkup"
  | "moto-docs"
  | "moto-pecas"
  | "moto-config"
  | "passaporte"
  | "dashboard"
  | "perfil"
  | "suporte"
  | "financeiro"
  | "agenda"
  | "certificados"
  | "oficinas"
  | "negociacao";

const DESTINATIONS: Destination[] = [
  // ── Dashboard / Início ───────────────────────────────────────
  {
    key: "dashboard",
    emoji: "🏠",
    label: "Início",
    description: "Painel principal com atalhos, moto ativa e resumo do dia",
    path: ["Início"],
    route: "/dashboard",
    category: "dashboard",
  },
  {
    key: "registrar-uso",
    emoji: "🏍️",
    label: "Registrar Uso",
    description: "Lançar horas ou km rodados na moto ativa diretamente do Início",
    path: ["Início", "Registrar Uso"],
    route: "/dashboard",
    category: "dashboard",
  },
  {
    key: "registrar-manutencao-dash",
    emoji: "🔧",
    label: "Registrar Manutenção",
    description: "Atalho rápido do Início para registrar qualquer manutenção",
    path: ["Início", "Registrar Manutenção"],
    route: "/dashboard",
    category: "dashboard",
  },

  // ── Minhas Motos ─────────────────────────────────────────────
  {
    key: "minhas-motos",
    emoji: "🏍️",
    label: "Minhas Motos",
    description: "Lista de todas as motos cadastradas na sua garagem",
    path: ["Minhas Motos"],
    route: "/motorcycles",
    category: "moto-config",
  },
  {
    key: "cadastrar-moto",
    emoji: "➕",
    label: "Cadastrar Nova Moto",
    description: "Adicionar uma moto à sua garagem TrailBook",
    path: ["Minhas Motos", "Cadastrar"],
    route: "/motorcycles/new",
    category: "moto-config",
  },

  // ── Painel da Moto ───────────────────────────────────────────
  {
    key: "painel-moto",
    emoji: "📊",
    label: "Painel da Moto",
    description: "Saúde, índices, alertas, pendências e próximas revisões",
    path: ["Minha Moto", "Painel"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=geral",
    needsMoto: true,
    category: "moto-painel",
  },
  {
    key: "saude-moto",
    emoji: "❤️",
    label: "Saúde da Moto",
    description: "Avaliação por categorias: motor, freios, suspensão, transmissão",
    path: ["Minha Moto", "Painel", "Saúde"],
    routeTemplate: "/motorcycles/$motorcycleId/health",
    needsMoto: true,
    category: "moto-painel",
  },
  {
    key: "plano-manutencao",
    emoji: "📅",
    label: "Plano de Manutenção",
    description: "Agenda de revisões e itens programados por km/horas",
    path: ["Minha Moto", "Painel", "Plano"],
    routeTemplate: "/motorcycles/$motorcycleId/plan",
    needsMoto: true,
    category: "moto-painel",
  },
  {
    key: "historico-manutencao",
    emoji: "📜",
    label: "Histórico de Manutenção",
    description: "Linha do tempo completa de todas as revisões e serviços",
    path: ["Minha Moto", "Painel", "Histórico"],
    routeTemplate: "/motorcycles/$motorcycleId/historico-manutencao",
    needsMoto: true,
    category: "moto-painel",
  },

  // ── Check-up e Laudo ─────────────────────────────────────────
  {
    key: "checkup-lista",
    emoji: "🩺",
    label: "Check-ups",
    description: "Lista de todos os check-ups e laudos realizados",
    path: ["Minha Moto", "Check-up"],
    routeTemplate: "/motorcycles/$motorcycleId/checkups",
    needsMoto: true,
    category: "moto-checkup",
  },
  {
    key: "checkup-novo",
    emoji: "➕",
    label: "Novo Check-up",
    description: "Iniciar uma nova avaliação de inspeção e gerar laudo",
    path: ["Minha Moto", "Check-up", "Novo Check-up"],
    routeTemplate: "/motorcycles/$motorcycleId/checkups/novo",
    needsMoto: true,
    category: "moto-checkup",
  },
  {
    key: "checkup-comparar",
    emoji: "📊",
    label: "Comparar Check-ups",
    description: "Comparar dois laudos para ver a evolução da moto",
    path: ["Minha Moto", "Check-up", "Comparar"],
    routeTemplate: "/motorcycles/$motorcycleId/checkups/comparar",
    needsMoto: true,
    category: "moto-checkup",
  },
  {
    key: "certificado-moto",
    emoji: "🏅",
    label: "Selos e Certificados",
    description: "Selos de qualidade e certificados públicos da moto",
    path: ["Minha Moto", "Check-up", "Selos"],
    routeTemplate: "/motorcycles/$motorcycleId/certificate",
    needsMoto: true,
    category: "moto-checkup",
  },

  // ── Lançamentos ──────────────────────────────────────────────
  {
    key: "lancamentos-menu",
    emoji: "📋",
    label: "Lançamentos",
    description: "Menu com todas as categorias de registros da moto",
    path: ["Minha Moto", "Lançamentos"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
    category: "moto-lancamentos",
  },
  {
    key: "lancamentos-manutencao",
    emoji: "🔧",
    label: "Manutenções",
    description: "Ver, registrar, editar ou excluir revisões, trocas e reparos",
    path: ["Minha Moto", "Lançamentos", "Manutenções"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
    category: "moto-lancamentos",
  },
  {
    key: "lancamentos-uso",
    emoji: "🏁",
    label: "Uso (horas/km)",
    description: "Ver, registrar, editar ou excluir entradas de uso",
    path: ["Minha Moto", "Lançamentos", "Uso"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
    category: "moto-lancamentos",
  },
  {
    key: "lancamentos-sinistro",
    emoji: "⚠️",
    label: "Sinistros",
    description: "Ver, registrar, editar ou excluir quedas, roubos e avarias",
    path: ["Minha Moto", "Lançamentos", "Sinistros"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
    category: "moto-lancamentos",
  },
  {
    key: "lancamentos-acessorio",
    emoji: "🎽",
    label: "Acessórios",
    description: "Ver, registrar, editar ou excluir equipamentos e proteções",
    path: ["Minha Moto", "Lançamentos", "Acessórios"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
    category: "moto-lancamentos",
  },
  {
    key: "lancamentos-nota",
    emoji: "📝",
    label: "Notas",
    description: "Ver, registrar, editar ou excluir observações livres",
    path: ["Minha Moto", "Lançamentos", "Notas"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
    category: "moto-lancamentos",
  },
  {
    key: "editar-lancamento",
    emoji: "✏️",
    label: "Editar Lançamento",
    description: "Corrigir ou atualizar qualquer registro já salvo",
    path: ["Minha Moto", "Lançamentos", "Categoria", "Editar"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=atividade",
    needsMoto: true,
    category: "moto-lancamentos",
  },
  {
    key: "registrar-manutencao",
    emoji: "🔧",
    label: "Nova Manutenção",
    description: "Formulário completo para registrar uma manutenção com peças e valores",
    path: ["Minha Moto", "Nova Manutenção"],
    routeTemplate: "/motorcycles/$motorcycleId/registrar-manutencao",
    needsMoto: true,
    category: "moto-lancamentos",
  },
  {
    key: "editar-manutencao",
    emoji: "✏️",
    label: "Editar Manutenção",
    description: "Alterar dados de uma manutenção já registrada",
    path: ["Minha Moto", "Lançamentos", "Manutenções", "Editar"],
    routeTemplate: "/motorcycles/$motorcycleId/editar-manutencao",
    needsMoto: true,
    category: "moto-lancamentos",
  },

  // ── Peças ────────────────────────────────────────────────────
  {
    key: "pecas-instaladas",
    emoji: "⚙️",
    label: "Peças Instaladas",
    description: "Componentes ativos na moto com histórico de substituição",
    path: ["Minha Moto", "Peças"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=componentes",
    needsMoto: true,
    category: "moto-pecas",
  },

  // ── Documentos da Moto ───────────────────────────────────────
  {
    key: "documentos-moto",
    emoji: "📄",
    label: "Documentos",
    description: "CRLV, laudos e arquivos da moto no cofre digital",
    path: ["Minha Moto", "Documentos"],
    routeTemplate: "/motorcycles/$motorcycleId?tab=documentos",
    needsMoto: true,
    category: "moto-docs",
  },

  // ── Dados e Configuração da Moto ─────────────────────────────
  {
    key: "editar-moto",
    emoji: "📝",
    label: "Dados da Moto",
    description: "Editar marca, modelo, ano, cor e informações cadastrais",
    path: ["Minha Moto", "Editar", "Dados Cadastrais"],
    routeTemplate: "/motorcycles/$motorcycleId/editar",
    needsMoto: true,
    category: "moto-config",
  },
  {
    key: "gerenciar-uso",
    emoji: "📊",
    label: "Gerenciar Uso",
    description: "Editar ou excluir registros de uso (horas/km) pela tela de edição",
    path: ["Minha Moto", "Editar", "Gerenciar Uso"],
    routeTemplate: "/motorcycles/$motorcycleId/editar",
    needsMoto: true,
    category: "moto-config",
  },
  {
    key: "controle-moto",
    emoji: "🔵",
    label: "Controle / Fiscalização",
    description: "Modo de apresentação da moto para fiscalização",
    path: ["Minha Moto", "Controle"],
    routeTemplate: "/motorcycles/$motorcycleId/control",
    needsMoto: true,
    category: "moto-config",
  },

  // ── Passaporte Digital ───────────────────────────────────────
  {
    key: "passaporte-digital",
    emoji: "🛡️",
    label: "Passaporte Digital",
    description: "Página pública com histórico, selos e saúde para compartilhar",
    path: ["Minha Moto", "Passaporte Digital"],
    routeTemplate: "/motorcycles/$motorcycleId/passport",
    needsMoto: true,
    category: "passaporte",
  },
  {
    key: "compartilhar-passaporte",
    emoji: "🔗",
    label: "Compartilhar Passaporte",
    description: "Gerar link/QR Code com validade para enviar a compradores ou oficinas",
    path: ["Minha Moto", "Passaporte Digital", "Compartilhar"],
    routeTemplate: "/motorcycles/$motorcycleId/passport",
    needsMoto: true,
    category: "passaporte",
  },
  {
    key: "fiscalizacao-laudo",
    emoji: "🔵",
    label: "Modo Fiscalização",
    description: "Acesso especial para apresentar nome, CPF e documento em fiscalização",
    path: ["Minha Moto", "Passaporte Digital", "Fiscalização"],
    routeTemplate: "/motorcycles/$motorcycleId/passport",
    needsMoto: true,
    category: "passaporte",
  },

  // ── Perfil e Conta ───────────────────────────────────────────
  {
    key: "meu-perfil",
    emoji: "👤",
    label: "Meu Perfil",
    description: "Nome, foto, CPF, telefone e dados pessoais",
    path: ["Perfil"],
    route: "/perfil",
    category: "perfil",
  },
  {
    key: "perfil-conta",
    emoji: "🔑",
    label: "Minha Conta",
    description: "E-mail, senha e configurações de acesso",
    path: ["Perfil", "Minha Conta"],
    route: "/perfil/conta",
    category: "perfil",
  },
  {
    key: "atalhos-perfil",
    emoji: "⚡",
    label: "Personalizar Atalhos",
    description: "Escolher e reorganizar os atalhos rápidos do Início",
    path: ["Perfil", "Atalhos"],
    route: "/perfil/atalhos",
    category: "perfil",
  },
  {
    key: "menu-inferior",
    emoji: "📌",
    label: "Menu Inferior",
    description: "Personalizar os itens exibidos na barra de navegação inferior",
    path: ["Perfil", "Menu Inferior"],
    route: "/perfil/menu-inferior",
    category: "perfil",
  },
  {
    key: "configuracoes",
    emoji: "⚙️",
    label: "Configurações",
    description: "Preferências gerais do aplicativo",
    path: ["Configurações"],
    route: "/settings",
    category: "perfil",
  },

  // ── Suporte e Chamados ───────────────────────────────────────
  {
    key: "meus-chamados",
    emoji: "🎫",
    label: "Meus Chamados",
    description: "Ver chamados abertos, em andamento e resolvidos",
    path: ["Suporte", "Meus Chamados"],
    route: "/tickets",
    category: "suporte",
  },
  {
    key: "novo-chamado",
    emoji: "➕",
    label: "Abrir Chamado",
    description: "Registrar dúvida, problema ou solicitação para o suporte",
    path: ["Suporte", "Novo Chamado"],
    route: "/tickets/new",
    category: "suporte",
  },
  {
    key: "mudar-cpf",
    emoji: "🪪",
    label: "Alterar CPF",
    description: "Solicitar alteração de CPF via chamado especial",
    path: ["Suporte", "Alterar CPF"],
    route: "/tickets/cpf-change",
    category: "suporte",
  },
  {
    key: "faq",
    emoji: "❓",
    label: "FAQ",
    description: "Perguntas frequentes e respostas rápidas",
    path: ["FAQ"],
    route: "/faq",
    category: "suporte",
  },
  {
    key: "como-funciona",
    emoji: "📖",
    label: "Como Funciona",
    description: "Tour guiado pelas funcionalidades do TrailBook",
    path: ["Como Funciona"],
    route: "/como-funciona",
    category: "suporte",
  },
  {
    key: "central",
    emoji: "🏢",
    label: "Central",
    description: "Central de avisos, novidades e comunicados do TrailBook",
    path: ["Central"],
    route: "/central",
    category: "suporte",
  },

  // ── Comunicação ──────────────────────────────────────────────
  {
    key: "mensagens",
    emoji: "💬",
    label: "Mensagens",
    description: "Conversa com o suporte e notificações do sistema",
    path: ["Mensagens"],
    route: "/messages",
    category: "suporte",
  },
  {
    key: "notificacoes",
    emoji: "🔔",
    label: "Notificações",
    description: "Alertas de revisões, documentos e atividades recentes",
    path: ["Notificações"],
    route: "/notifications",
    category: "suporte",
  },
  {
    key: "comunicacao",
    emoji: "📢",
    label: "Comunicação",
    description: "Avisos e comunicados para proprietários de moto",
    path: ["Comunicação"],
    route: "/comunicacao",
    category: "suporte",
  },

  // ── Financeiro e Planos ──────────────────────────────────────
  {
    key: "financeiro",
    emoji: "💰",
    label: "Financeiro",
    description: "Resumo de gastos com manutenções e custo por km/hora",
    path: ["Financeiro"],
    route: "/financial",
    category: "financeiro",
  },
  {
    key: "planos",
    emoji: "⭐",
    label: "Planos TrailBook",
    description: "Ver e assinar planos disponíveis no TrailBook",
    path: ["Planos"],
    route: "/plans",
    category: "financeiro",
  },
  {
    key: "transferencias",
    emoji: "🔄",
    label: "Transferências",
    description: "Transferência de propriedade e histórico de recibos",
    path: ["Transferências"],
    route: "/transfers",
    category: "negociacao",
  },
  {
    key: "recibos",
    emoji: "🧾",
    label: "Recibos",
    description: "Recibos de compra e venda gerados pelo TrailBook",
    path: ["Transferências", "Recibos"],
    route: "/transfers",
    category: "negociacao",
  },

  // ── Agenda ───────────────────────────────────────────────────
  {
    key: "agenda",
    emoji: "📆",
    label: "Agenda",
    description: "Compromissos agendados: revisões, vistorias e serviços",
    path: ["Agenda"],
    route: "/agenda",
    category: "agenda",
  },

  // ── Certificados ─────────────────────────────────────────────
  {
    key: "certificados",
    emoji: "🏅",
    label: "Certificados",
    description: "Certificados públicos com validade e registro de acessos",
    path: ["Certificados"],
    route: "/certificates",
    category: "certificados",
  },

  // ── Oficinas ─────────────────────────────────────────────────
  {
    key: "oficinas",
    emoji: "🏪",
    label: "Oficinas",
    description: "Encontrar e avaliar oficinas credenciadas perto de você",
    path: ["Oficinas"],
    route: "/workshops",
    category: "oficinas",
  },

  // ── Meus Itens ───────────────────────────────────────────────
  {
    key: "meus-itens",
    emoji: "📦",
    label: "Meus Itens",
    description: "Biblioteca pessoal de peças, acessórios e equipamentos",
    path: ["Meus Itens"],
    route: "/documents",
    category: "moto-docs",
  },
];

// Índice rápido por key
const DEST_BY_KEY = Object.fromEntries(DESTINATIONS.map((d) => [d.key, d]));

// Slugs de artigos KB → destino correspondente (para NavigationGuide)
const SLUG_TO_DEST: Record<string, string> = {
  "cadastrar-moto":        "cadastrar-moto",
  "registrar-manutencao":  "lancamentos-manutencao",
  "registrar-uso":         "registrar-uso",
  "health-avaliacao":      "saude-moto",
  "check-up-laudo":        "checkup-lista",
  "plano-manutencao":      "plano-manutencao",
  "passaporte-digital":    "passaporte-digital",
  "fiscalizacao-laudo":    "fiscalizacao-laudo",
  "selos-qualidade":       "certificado-moto",
  "meus-itens":            "meus-itens",
  "abrir-chamado":         "novo-chamado",
  "trailbook-registrar-uso": "registrar-uso",
};

// Módulos KB → categoria de destinos (para busca contextual)
const MODULE_TO_CATEGORY: Record<string, DestCategory[]> = {
  "maintenance":   ["moto-lancamentos"],
  "health":        ["moto-checkup", "moto-painel"],
  "passport":      ["passaporte"],
  "certificate":   ["moto-checkup", "certificados"],
  "fiscal":        ["passaporte"],
  "fiscalizacao":  ["passaporte"],
  "motorcycle":    ["moto-config", "moto-painel"],
  "support":       ["suporte"],
  "agenda":        ["agenda"],
  "financial":     ["financeiro"],
  "workshop":      ["oficinas"],
  "profile":       ["perfil"],
};

// Slugs com fluxo de edição/exclusão de lançamento
const EDIT_FLOW_SLUGS = new Set([
  "registrar-manutencao", "editar-lancamento", "excluir-lancamento",
  "lancamentos-manutencao", "lancamentos-uso", "lancamentos-sinistro",
  "lancamentos-acessorio", "lancamentos-nota",
]);

// ── Atalhos por tela (contextual shortcuts) ───────────────────
// Quais atalhos mostrar dependendo do moduleKey atual
const CONTEXT_SHORTCUTS: Record<string, string[]> = {
  dashboard:    ["registrar-uso", "registrar-manutencao-dash", "painel-moto", "agenda"],
  motorcycle:   ["painel-moto", "lancamentos-menu", "checkup-lista", "passaporte-digital", "pecas-instaladas", "documentos-moto"],
  maintenance:  ["lancamentos-manutencao", "registrar-manutencao", "editar-lancamento", "historico-manutencao"],
  health:       ["saude-moto", "checkup-lista", "checkup-novo", "plano-manutencao"],
  passport:     ["passaporte-digital", "compartilhar-passaporte", "fiscalizacao-laudo"],
  certificate:  ["certificado-moto", "certificados", "checkup-lista"],
  fiscal:       ["fiscalizacao-laudo", "passaporte-digital", "controle-moto"],
  profile:      ["meu-perfil", "perfil-conta", "atalhos-perfil", "configuracoes"],
  support:      ["meus-chamados", "novo-chamado", "faq", "mensagens"],
  financial:    ["financeiro", "planos", "transferencias"],
  agenda:       ["agenda", "plano-manutencao"],
  general:      ["painel-moto", "lancamentos-menu", "checkup-lista", "passaporte-digital", "novo-chamado", "financeiro"],
};

// Atalhos padrão da home (quando não há moto selecionada)
const HOME_SHORTCUTS_NO_MOTO = [
  "dashboard", "cadastrar-moto", "meus-chamados", "faq", "planos", "configuracoes",
];

// Atalhos padrão da home (com moto selecionada)
const HOME_SHORTCUTS_WITH_MOTO = [
  "painel-moto", "lancamentos-menu", "checkup-lista",
  "passaporte-digital", "editar-lancamento", "novo-chamado",
];

// ── HOME_LABELS — compatibilidade com slugs da KB ─────────────
const HOME_LABELS: Record<string, { label: string; emoji: string; destKey?: string }> = {
  "cadastrar-moto":        { label: "Cadastrar ou gerenciar minha moto",          emoji: "🏍️", destKey: "cadastrar-moto" },
  "registrar-manutencao":  { label: "Registrar uma manutenção",                    emoji: "🔧", destKey: "lancamentos-manutencao" },
  "registrar-uso":         { label: "Registrar uso (horas ou km)",                 emoji: "🏁", destKey: "registrar-uso" },
  "health-avaliacao":      { label: "Ver a saúde da minha moto",                   emoji: "❤️", destKey: "saude-moto" },
  "check-up-laudo":        { label: "Gerar ou consultar um Laudo",                 emoji: "📋", destKey: "checkup-lista" },
  "plano-manutencao":      { label: "Entender meu plano de manutenção",            emoji: "📅", destKey: "plano-manutencao" },
  "passaporte-digital":    { label: "Compartilhar o Passaporte Digital",            emoji: "🛡️", destKey: "passaporte-digital" },
  "fiscalizacao-laudo":    { label: "Apresentar minha moto em fiscalização",        emoji: "🔵", destKey: "fiscalizacao-laudo" },
  "selos-qualidade":       { label: "Entender os Selos de Qualidade",              emoji: "🏅", destKey: "certificado-moto" },
  "meus-itens":            { label: "Meus Itens — biblioteca pessoal",             emoji: "📦", destKey: "meus-itens" },
  "abrir-chamado":         { label: "Preciso de ajuda / suporte",                  emoji: "💬", destKey: "novo-chamado" },
  "trailbook-registrar-uso": { label: "Registrar uso da moto (horas/km)",          emoji: "🏁", destKey: "registrar-uso" },
};

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────

interface Props {
  state: AssistantState;
  ctx: AssistantContext;
  moduleStatus: string;
}

export function AssistantDrawer({ state, ctx, moduleStatus }: Props) {
  const {
    open, closeDrawer,
    view, goHome, openTopics, openTopic, openArticle, goBack,
    selectedTopic, selectedArticle,
    query, setQuery,
    submitted, submitQuery, resetSearch,
    results, topResult, confidence, related,
    topResultModuleStatus,
    homeSuggestions, topicGroups, suggestions,
    loading,
    recordUnanswered,
    getModuleStatus,
  } = state;

  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef  = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      fabRef.current = document.activeElement as HTMLElement;
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      fabRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open, closeDrawer]);

  useEffect(() => {
    if (submitted && confidence === "ZERO") recordUnanswered();
  }, [submitted, confidence, recordUnanswered]);

  if (!open) return null;

  // ── Helpers ─────────────────────────────────────────────────

  function handleSearch(q: string) {
    const t = q.trim();
    if (t) submitQuery(t);
  }

  function resolvedRoute(article: HelpArticle) {
    if (!article.route_template) return null;
    if (article.needs_motorcycle && !ctx.motorcycleId) return null;
    return article.route_template.replace("$motorcycleId", ctx.motorcycleId ?? "");
  }

  function handleCTA(article: HelpArticle) {
    const route = resolvedRoute(article);
    if (article.needs_motorcycle && !ctx.motorcycleId) {
      navigate({ to: "/motorcycles" as never });
    } else if (route) {
      navigate({ to: route as never });
    }
    closeDrawer();
  }

  function handleDest(d: Destination) {
    if (d.needsMoto && !ctx.motorcycleId) {
      navigate({ to: "/motorcycles" as never });
    } else if (d.routeTemplate && ctx.motorcycleId) {
      navigate({ to: d.routeTemplate.replace("$motorcycleId", ctx.motorcycleId) as never });
    } else if (d.route) {
      navigate({ to: d.route as never });
    }
    closeDrawer();
  }

  async function handleOpenTicket() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("tickets").insert({
        user_id: user.id,
        title: query.trim() || "Dúvida via Assistente TrailBook",
        description: `Via Assistente TrailBook\nPergunta: "${query}"\nTela: ${ctx.pathname}`,
        type: "question" as const,
        module: "other" as const,
        status: "open" as const,
        priority: "medium" as const,
      });
      navigate({ to: "/tickets" as never });
    } catch (_) {}
    closeDrawer();
  }

  const showBack = view !== "home";
  const inMaintenance = moduleStatus === "maintenance";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={closeDrawer} aria-hidden="true" />

      {/* Wrapper de posicionamento — mobile: bottom sheet / desktop: painel lateral direito centralizado */}
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-end sm:justify-center md:items-end md:justify-end md:pr-6 md:pb-6 pointer-events-none">
      <div
        role="dialog"
        aria-label="Assistente TrailBook"
        aria-modal="true"
        className="pointer-events-auto flex flex-col bg-background shadow-2xl outline-none
          w-full rounded-t-2xl border-t border-border/50
          max-h-[92dvh]
          md:w-[420px] md:rounded-2xl md:border md:border-border/60 md:max-h-[85dvh]
          lg:w-[440px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle — só faz sentido no mobile (bottom sheet) */}
        <div className="mx-auto mt-3 mb-1 h-1 w-12 rounded-full bg-border/60 shrink-0 md:hidden" />

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pb-3 pt-2 shrink-0 border-b border-border/40">
          {showBack && (
            <button onClick={goBack} aria-label="Voltar"
              className="rounded-xl p-2 hover:bg-muted transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {!showBack && (
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-sm leading-tight truncate">
                {view === "topics"            ? "Explorar TrailBook"
                 : view === "topic-detail" && selectedTopic  ? selectedTopic.label
                 : view === "article"      && selectedArticle ? selectedArticle.title
                 : "Assistente TrailBook"}
              </h2>
              {view === "home" && (
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  Guia completo — leva você direto ao destino
                </p>
              )}
            </div>
          </div>
          {view !== "home" && (
            <button onClick={goHome} aria-label="Início do assistente"
              className="rounded-xl p-2 hover:bg-muted transition-colors text-muted-foreground">
              <Home className="h-4 w-4" />
            </button>
          )}
          <button onClick={closeDrawer} aria-label="Fechar assistente"
            className="rounded-xl p-2 hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Campo de busca */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (submitted) resetSearch(); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(query); }}
              placeholder="O que você quer fazer ou saber?"
              className="pl-9 pr-16 text-sm h-10 rounded-xl bg-muted/40 border-border/60 focus:bg-background"
              aria-label="Buscar no Assistente"
            />
            {query.trim() && (
              <button
                onClick={() => handleSearch(query)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-2.5 py-1
                  text-[11px] font-semibold text-primary-foreground"
              >
                Buscar
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1 space-y-3">

          {inMaintenance && (
            <div className="py-10 text-center space-y-2">
              <div className="text-3xl">🚧</div>
              <p className="text-sm font-medium">Assistente em manutenção</p>
              <p className="text-xs text-muted-foreground">Estamos aprimorando. Tente em breve.</p>
            </div>
          )}

          {!inMaintenance && loading && (
            <div className="py-10 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">Carregando…</p>
            </div>
          )}

          {!inMaintenance && !loading && view === "home" && (
            <HomeView
              homeSuggestions={homeSuggestions}
              contextSuggestions={suggestions}
              ctx={ctx}
              onArticle={openArticle}
              onOpenTopics={openTopics}
              onDest={handleDest}
            />
          )}

          {!inMaintenance && !loading && view === "topics" && (
            <TopicsView groups={topicGroups} onTopic={openTopic} />
          )}

          {!inMaintenance && !loading && view === "topic-detail" && selectedTopic && (
            <TopicDetailView topic={selectedTopic} onArticle={openArticle} />
          )}

          {!inMaintenance && !loading && view === "article" && selectedArticle && (
            <ArticleView
              article={selectedArticle}
              ctx={ctx}
              related={related}
              moduleStatus={getModuleStatus(selectedArticle)}
              onCTA={() => handleCTA(selectedArticle)}
              onRelated={openArticle}
              onDest={handleDest}
            />
          )}

          {!inMaintenance && view === "search" && (
            <SearchView
              results={results}
              confidence={confidence}
              topResult={topResult}
              related={related}
              topResultModuleStatus={topResultModuleStatus}
              ctx={ctx}
              loading={loading}
              onCTA={handleCTA}
              onRelated={openArticle}
              onOpenTopics={openTopics}
              onOpenTicket={handleOpenTicket}
              onDest={handleDest}
            />
          )}

        </div>
      </div>
      </div>{/* /wrapper posicionamento */}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTES DE UI
// ─────────────────────────────────────────────────────────────

// Trilha de navegação compacta (inline)
function NavPath({ path }: { path: string[] }) {
  if (!path.length) return null;
  return (
    <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
      {path.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />}
          <span className="text-[10px] text-muted-foreground/60 leading-tight">{seg}</span>
        </span>
      ))}
    </div>
  );
}

// Guia de caminho visual (bloco destacado)
function NavigationGuide({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <div className="rounded-xl bg-muted/40 border border-border/50 p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3 w-3" />
        Como chegar lá
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        {steps.map((step, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
            <span className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-medium",
              i === 0
                ? "bg-primary/10 text-primary"
                : i === steps.length - 1
                  ? "bg-foreground/10 text-foreground"
                  : "bg-muted text-muted-foreground",
            )}>
              {step}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Guia passo a passo numerado
function StepGuide({ title, steps }: { title: string; steps: { icon: string; text: string }[] }) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border/50 p-3 space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3 w-3" />
        {title}
      </p>
      <div className="space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed flex-1">
              <span className="mr-1">{s.icon}</span>{s.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Card de destino (atalho)
function DestCard({
  dest, onDest, size = "sm",
}: {
  dest: Destination;
  onDest: (d: Destination) => void;
  size?: "sm" | "md";
}) {
  return (
    <button
      onClick={() => onDest(dest)}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border border-border bg-card text-left transition-colors",
        "hover:border-primary/30 hover:bg-muted/50 group",
        size === "md" ? "p-3" : "px-3 py-2.5",
      )}
    >
      <div className="flex items-center gap-2 w-full">
        <span className={size === "md" ? "text-xl" : "text-base shrink-0"}>{dest.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium leading-tight truncate", size === "md" ? "text-sm" : "text-xs")}>{dest.label}</p>
          {size === "md" && (
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{dest.description}</p>
          )}
          <NavPath path={dest.path} />
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60 transition-colors" />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// HOME VIEW
// ─────────────────────────────────────────────────────────────

function HomeView({
  homeSuggestions, contextSuggestions, ctx, onArticle, onOpenTopics, onDest,
}: {
  homeSuggestions: HelpArticle[];
  contextSuggestions: HelpArticle[];
  ctx: AssistantContext;
  onArticle: (a: HelpArticle) => void;
  onOpenTopics: () => void;
  onDest: (d: Destination) => void;
}) {
  const isGeneral = ctx.moduleKey === "general" || ctx.moduleKey === "dashboard";
  const hasContextSuggs = !isGeneral && contextSuggestions.length >= 2;

  // Atalhos contextuais baseados na tela atual
  const shortcutKeys = ctx.motorcycleId
    ? (CONTEXT_SHORTCUTS[ctx.moduleKey] ?? HOME_SHORTCUTS_WITH_MOTO)
    : HOME_SHORTCUTS_NO_MOTO;
  const shortcuts = shortcutKeys
    .map((k) => DEST_BY_KEY[k])
    .filter((d): d is Destination => !!d)
    .slice(0, 8);

  const showEditGuide = ctx.motorcycleId && (
    ctx.moduleKey === "maintenance" || ctx.moduleKey === "motorcycle"
  );

  return (
    <div className="space-y-4">

      {/* Banner boas-vindas */}
      {isGeneral && !ctx.motorcycleId && (
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-3.5 flex items-start gap-3">
          <div className="text-2xl mt-0.5">🏍️</div>
          <div>
            <p className="text-sm font-medium leading-snug">Assistente TrailBook</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Descreva o que você quer fazer — ou escolha um atalho abaixo.
              Te levo direto ao lugar certo, sem rodeios.
            </p>
          </div>
        </div>
      )}

      {/* Sugestões contextuais (quando KB tem sugestões para esta tela) */}
      {hasContextSuggs && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-primary/60" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Nesta tela</p>
          </div>
          {contextSuggestions.map((a) => {
            const meta = HOME_LABELS[a.slug];
            const dest = meta?.destKey ? DEST_BY_KEY[meta.destKey] : null;
            return (
              <button key={a.id} onClick={() => onArticle(a)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5
                  text-left hover:border-primary/40 hover:bg-muted/50 transition-colors group">
                <span className="text-base shrink-0">{meta?.emoji ?? "💡"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{meta?.label ?? a.title}</p>
                  {dest && <NavPath path={dest.path} />}
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60 transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      {/* Atalhos rápidos */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-primary/60" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Ir direto para
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {shortcuts.map((d) => (
            <DestCard key={d.key} dest={d} onDest={onDest} size="md" />
          ))}
        </div>
      </div>

      {/* Guia de edição — quando está na área de lançamentos */}
      {showEditGuide && (
        <StepGuide
          title="Editar ou excluir um lançamento"
          steps={[
            { icon: "📋", text: "Toque em Lançamentos no menu da moto" },
            { icon: "🔍", text: "Escolha a categoria: Manutenções, Uso, Sinistros, Acessórios ou Notas" },
            { icon: "✏️", text: "Toque em Editar para corrigir, ou Excluir para remover o registro" },
          ]}
        />
      )}

      <div className="border-t border-border/40" />

      {/* Artigos da KB */}
      {homeSuggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-primary/60" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Guias e tutoriais
            </p>
          </div>
          {homeSuggestions.map((a) => {
            const meta = HOME_LABELS[a.slug];
            const dest = meta?.destKey ? DEST_BY_KEY[meta.destKey] : null;
            return (
              <button key={a.id} onClick={() => onArticle(a)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5
                  text-left hover:border-primary/40 hover:bg-muted/50 transition-colors group">
                <span className="text-base shrink-0">{meta?.emoji ?? "💡"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{meta?.label ?? a.title}</p>
                  {dest && <NavPath path={dest.path} />}
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60 transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      <button onClick={onOpenTopics}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/70
          bg-muted/30 px-3 py-2.5 text-xs font-medium text-muted-foreground
          hover:text-foreground hover:border-border hover:bg-muted/50 transition-colors">
        <Layers className="h-3.5 w-3.5" />
        Ver todas as áreas de ajuda
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TOPICS VIEW
// ─────────────────────────────────────────────────────────────

function TopicsView({ groups, onTopic }: { groups: TopicGroup[]; onTopic: (t: TopicGroup) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pb-1">
        Explorar por área
      </p>
      {groups.map((g) => {
        const Icon = ICON_MAP[g.icon] ?? Wrench;
        return (
          <button key={g.key} onClick={() => onTopic(g)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3
              text-left hover:border-primary/40 hover:bg-muted/50 transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary/70" aria-hidden="true" />
            </div>
            <span className="flex-1 text-sm font-medium">{g.label}</span>
            <span className="text-[11px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground shrink-0">
              {g.articles.length}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60 transition-colors" />
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TOPIC DETAIL VIEW
// ─────────────────────────────────────────────────────────────

function TopicDetailView({ topic, onArticle }: { topic: TopicGroup; onArticle: (a: HelpArticle) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pb-1">
        {topic.articles.length} artigo{topic.articles.length !== 1 ? "s" : ""} disponíve{topic.articles.length !== 1 ? "is" : "l"}
      </p>
      {topic.articles.map((a) => (
        <button key={a.id} onClick={() => onArticle(a)}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-3
            text-left hover:border-primary/40 hover:bg-muted/50 transition-colors group">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">{a.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{a.summary}</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60 transition-colors" />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ARTICLE VIEW
// ─────────────────────────────────────────────────────────────

function ArticleView({
  article, ctx, related, moduleStatus, onCTA, onRelated, onDest,
}: {
  article: HelpArticle;
  ctx: AssistantContext;
  related: HelpArticle[];
  moduleStatus: import("@/lib/modules").ModuleStatus | null;
  onCTA: () => void;
  onRelated: (a: HelpArticle) => void;
  onDest: (d: Destination) => void;
}) {
  const needsMoto = article.needs_motorcycle && !ctx.motorcycleId;
  const isUnavailable = moduleStatus === "disabled" || moduleStatus === "maintenance";
  const hasRoute = !!(article.route_template || needsMoto) && !isUnavailable;

  // Resolver trilha de navegação do destino correspondente
  const meta = HOME_LABELS[article.slug];
  const dest = meta?.destKey ? DEST_BY_KEY[meta.destKey] : null;
  const navSteps = dest?.path ?? [];

  // Destinos relacionados pela categoria do artigo
  const relatedCategories = MODULE_TO_CATEGORY[article.module_key ?? ""] ?? [];
  const relatedDests = DESTINATIONS
    .filter((d) => relatedCategories.includes(d.category) && d.key !== dest?.key)
    .slice(0, 3);

  const showEditGuide =
    (EDIT_FLOW_SLUGS.has(article.slug) || article.module_key === "maintenance")
    && ctx.motorcycleId;

  return (
    <div className="space-y-3">
      {navSteps.length > 0 && <NavigationGuide steps={navSteps} />}

      {showEditGuide && (
        <StepGuide
          title="Editar ou excluir um lançamento"
          steps={[
            { icon: "📋", text: "Toque em Lançamentos no menu da moto" },
            { icon: "🔍", text: "Escolha a categoria: Manutenções, Uso, Sinistros, Acessórios ou Notas" },
            { icon: "✏️", text: "Toque em Editar para corrigir, ou Excluir para remover" },
          ]}
        />
      )}

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{article.summary}</p>
        {article.body_md && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm
            [&_strong]:font-semibold [&_ul]:pl-4 [&_li]:mt-1 [&_h2]:text-sm [&_h2]:font-semibold
            [&_h2]:mt-3 [&_p]:leading-relaxed border-t border-border/40 pt-3">
            <ReactMarkdown>{article.body_md}</ReactMarkdown>
          </div>
        )}
        {needsMoto && !isUnavailable && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              🏍️ Selecione uma moto primeiro para continuar.
            </p>
          </div>
        )}
        {moduleStatus === "maintenance" && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              🚧 Esta funcionalidade está temporariamente em manutenção.
            </p>
          </div>
        )}
        {moduleStatus === "disabled" && (
          <div className="rounded-lg bg-muted border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground font-medium">Esta funcionalidade ainda não está disponível.</p>
          </div>
        )}
        {hasRoute && (
          <Button size="sm" className="w-full btn-glow mt-1" onClick={onCTA}>
            {needsMoto ? "🏍️ Ver minhas motos" : (article.cta_label ?? "Ir para a tela →")}
          </Button>
        )}
      </div>

      {/* Destinos relacionados da mesma área */}
      {relatedDests.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Nesta mesma área
          </p>
          {relatedDests.map((d) => (
            <DestCard key={d.key} dest={d} onDest={onDest} />
          ))}
        </div>
      )}

      {/* Artigos relacionados da KB */}
      {related.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Guias relacionados
          </p>
          {related.slice(0, 2).map((r) => (
            <button key={r.id} onClick={() => onRelated(r)}
              className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5
                text-left text-sm hover:border-primary/40 hover:bg-muted/50 transition-colors group">
              <span className="flex-1 leading-snug">{r.title}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SEARCH VIEW
// ─────────────────────────────────────────────────────────────

function SearchView({
  results, confidence, topResult, related, topResultModuleStatus, ctx, loading,
  onCTA, onRelated, onOpenTopics, onOpenTicket, onDest,
}: {
  results: ReturnType<typeof useAssistant>["results"];
  confidence: ReturnType<typeof useAssistant>["confidence"];
  topResult: ReturnType<typeof useAssistant>["topResult"];
  related: ReturnType<typeof useAssistant>["related"];
  topResultModuleStatus: ReturnType<typeof useAssistant>["topResultModuleStatus"];
  ctx: AssistantContext;
  loading: boolean;
  onCTA: (a: HelpArticle) => void;
  onRelated: (a: HelpArticle) => void;
  onOpenTopics: () => void;
  onOpenTicket: () => void;
  onDest: (d: Destination) => void;
}) {
  if (loading) {
    return (
      <div className="py-10 text-center space-y-2">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground">Buscando…</p>
      </div>
    );
  }

  if (confidence === "HIGH" || confidence === "MEDIUM") {
    const article = topResult!.article;
    const needsMoto = article.needs_motorcycle && !ctx.motorcycleId;
    const isUnavailable = topResultModuleStatus === "disabled" || topResultModuleStatus === "maintenance";
    const hasRoute = !!(article.route_template || needsMoto) && !isUnavailable;
    const meta = HOME_LABELS[article.slug];
    const dest = meta?.destKey ? DEST_BY_KEY[meta.destKey] : null;
    const navSteps = dest?.path ?? [];
    const showEditGuide =
      (EDIT_FLOW_SLUGS.has(article.slug) || article.module_key === "maintenance")
      && !!ctx.motorcycleId;
    const relatedCategories = MODULE_TO_CATEGORY[article.module_key ?? ""] ?? [];
    const relatedDests = DESTINATIONS
      .filter((d) => relatedCategories.includes(d.category) && d.key !== dest?.key)
      .slice(0, 2);

    return (
      <div className="space-y-3">
        {confidence === "MEDIUM" && (
          <p className="text-xs text-muted-foreground">Isso pode ser o que você procura?</p>
        )}
        {navSteps.length > 0 && <NavigationGuide steps={navSteps} />}
        {showEditGuide && (
          <StepGuide
            title="Editar ou excluir um lançamento"
            steps={[
              { icon: "📋", text: "Toque em Lançamentos no menu da moto" },
              { icon: "🔍", text: "Escolha a categoria: Manutenções, Uso, Sinistros, Acessórios ou Notas" },
              { icon: "✏️", text: "Toque em Editar para corrigir, ou Excluir para remover" },
            ]}
          />
        )}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <p className="font-semibold text-sm">{article.title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{article.summary}</p>
          {confidence === "HIGH" && article.body_md && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm pt-1
              [&_strong]:font-semibold [&_ul]:pl-4 [&_li]:mt-0.5 [&_h2]:text-sm [&_h2]:font-semibold">
              <ReactMarkdown>{article.body_md}</ReactMarkdown>
            </div>
          )}
          {topResultModuleStatus === "maintenance" && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">🚧 Funcionalidade em manutenção.</p>
            </div>
          )}
          {topResultModuleStatus === "disabled" && (
            <p className="text-xs text-muted-foreground font-medium">Funcionalidade não disponível.</p>
          )}
          {needsMoto && !isUnavailable && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">🏍️ Selecione uma moto primeiro.</p>
            </div>
          )}
          {hasRoute && (
            <Button size="sm" className="w-full btn-glow mt-1" onClick={() => onCTA(article)}>
              {needsMoto ? "🏍️ Ver minhas motos" : (article.cta_label ?? "Ir para a tela →")}
            </Button>
          )}
        </div>
        {confidence === "MEDIUM" && results.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Outras opções</p>
            {results.slice(1).map((r) => (
              <button key={r.article.id} onClick={() => onRelated(r.article)}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm hover:border-primary/40 hover:bg-muted/50 transition-colors group">
                <span className="flex-1">{r.article.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60" />
              </button>
            ))}
          </div>
        )}
        {relatedDests.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Ir direto para</p>
            {relatedDests.map((d) => (
              <DestCard key={d.key} dest={d} onDest={onDest} />
            ))}
          </div>
        )}
        {related.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Guias relacionados</p>
            {related.slice(0, 2).map((r) => (
              <button key={r.id} onClick={() => onRelated(r)}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm hover:border-primary/40 hover:bg-muted/50 transition-colors group">
                <span className="flex-1">{r.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (confidence === "LOW") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-muted/40 border border-border p-3">
          <p className="text-sm font-medium">Não encontrei uma correspondência exata.</p>
          <p className="text-xs text-muted-foreground mt-1">Veja as sugestões ou navegue pelas áreas de ajuda.</p>
        </div>
        {results.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Talvez relacionado</p>
            {results.map((r) => (
              <button key={r.article.id} onClick={() => onRelated(r.article)}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm hover:border-primary/40 hover:bg-muted/50 transition-colors group">
                <span className="flex-1">{r.article.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary/60" />
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={onOpenTopics}>
            <Layers className="mr-2 h-4 w-4" /> Explorar todas as áreas
          </Button>
          <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={onOpenTicket}>
            <LifeBuoy className="mr-2 h-4 w-4" /> Abrir chamado de suporte
          </Button>
        </div>
      </div>
    );
  }

  // ZERO
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-muted/40 border border-border p-4 text-center space-y-1.5">
        <div className="text-3xl">🤔</div>
        <p className="text-sm font-medium">Ainda não tenho uma orientação para isso.</p>
        <p className="text-xs text-muted-foreground">Registrei sua dúvida para melhorarmos o Assistente.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="outline" className="w-full rounded-xl" onClick={onOpenTopics}>
          <Layers className="mr-2 h-4 w-4" /> Explorar todas as áreas de ajuda
        </Button>
        <Button className="w-full btn-glow rounded-xl" onClick={onOpenTicket}>
          <LifeBuoy className="mr-2 h-4 w-4" /> Abrir chamado de suporte
        </Button>
      </div>
    </div>
  );
}
