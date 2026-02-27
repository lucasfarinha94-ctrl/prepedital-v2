// ============================================================
// FEATURE GATING — controle de acesso por plano
// Usado tanto no servidor (tRPC) quanto no cliente (UI condicional)
// ============================================================

import type { PlanTier } from "@prisma/client";

// ────────────────────────────────────────────────────────────
// DEFINIÇÃO DOS PLANOS
// ────────────────────────────────────────────────────────────

export interface PlanLimits {
  maxEditais: number;         // -1 = ilimitado
  maxQuestoesDia: number;
  maxSimuladosDia: number;
  maxDisciplinas: number;     // -1 = todas
}

export interface PlanFeatures {
  hasSimulados: boolean;
  hasRevisaoIA: boolean;
  hasPdfExport: boolean;
  hasRelatoriosAvancados: boolean;
  hasSuportePrioritario: boolean;
  hasBancoCompleto: boolean;
  hasApiAccess: boolean;
  hasDebugTools: boolean;
}

export interface PlanConfig extends PlanLimits, PlanFeatures {
  nome: string;
  descricao: string;
  precoMensal: number | null; // null = gratuito
}

// ────────────────────────────────────────────────────────────
// CONFIGURAÇÃO POR PLANO
// ────────────────────────────────────────────────────────────

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  FREE: {
    nome: "Free",
    descricao: "Para conhecer a plataforma",
    precoMensal: null,

    // Limites
    maxEditais: 1,
    maxQuestoesDia: 30,
    maxSimuladosDia: 0,
    maxDisciplinas: 3,

    // Features
    hasSimulados: false,
    hasRevisaoIA: false,
    hasPdfExport: false,
    hasRelatoriosAvancados: false,
    hasSuportePrioritario: false,
    hasBancoCompleto: false,
    hasApiAccess: false,
    hasDebugTools: false,
  },

  PRO: {
    nome: "Pro",
    descricao: "Para quem leva a sério",
    precoMensal: 49.9,

    maxEditais: 3,
    maxQuestoesDia: 200,
    maxSimuladosDia: 3,
    maxDisciplinas: -1,

    hasSimulados: true,
    hasRevisaoIA: true,
    hasPdfExport: true,
    hasRelatoriosAvancados: false,
    hasSuportePrioritario: false,
    hasBancoCompleto: false,
    hasApiAccess: false,
    hasDebugTools: false,
  },

  ELITE: {
    nome: "Elite",
    descricao: "Preparação sem compromisso",
    precoMensal: 99.9,

    maxEditais: -1,
    maxQuestoesDia: -1,
    maxSimuladosDia: -1,
    maxDisciplinas: -1,

    hasSimulados: true,
    hasRevisaoIA: true,
    hasPdfExport: true,
    hasRelatoriosAvancados: true,
    hasSuportePrioritario: true,
    hasBancoCompleto: true,
    hasApiAccess: false,
    hasDebugTools: false,
  },

  FOUNDER: {
    nome: "Founder",
    descricao: "Acesso fundador vitalício",
    precoMensal: null,

    maxEditais: -1,
    maxQuestoesDia: -1,
    maxSimuladosDia: -1,
    maxDisciplinas: -1,

    hasSimulados: true,
    hasRevisaoIA: true,
    hasPdfExport: true,
    hasRelatoriosAvancados: true,
    hasSuportePrioritario: true,
    hasBancoCompleto: true,
    hasApiAccess: true,
    hasDebugTools: true,
  },
};

// Ordem de hierarquia dos planos
const PLAN_ORDER: PlanTier[] = ["FREE", "PRO", "ELITE", "FOUNDER"];

// ────────────────────────────────────────────────────────────
// HELPERS DE VERIFICAÇÃO
// ────────────────────────────────────────────────────────────

/**
 * Verifica se o plano do usuário tem acesso a uma feature
 */
export function hasFeature(
  userPlan: PlanTier,
  feature: keyof PlanFeatures
): boolean {
  return PLAN_CONFIGS[userPlan][feature];
}

/**
 * Verifica se o usuário está dentro do limite de um recurso
 * -1 significa ilimitado
 */
export function withinLimit(
  userPlan: PlanTier,
  limit: keyof PlanLimits,
  current: number
): boolean {
  const max = PLAN_CONFIGS[userPlan][limit];
  if (max === -1) return true;
  return current < max;
}

/**
 * Retorna o plano mínimo necessário para uma feature
 */
export function minimumPlanForFeature(
  feature: keyof PlanFeatures
): PlanTier | null {
  for (const plan of PLAN_ORDER) {
    if (PLAN_CONFIGS[plan][feature]) return plan;
  }
  return null;
}

/**
 * Verifica se o plano A tem pelo menos o mesmo nível do plano B
 */
export function planAtLeast(userPlan: PlanTier, required: PlanTier): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(required);
}

/**
 * Retorna configuração completa do plano de um usuário
 */
export function getPlanConfig(plan: PlanTier): PlanConfig {
  return PLAN_CONFIGS[plan];
}

// ────────────────────────────────────────────────────────────
// GATE DE FEATURES — para uso nos tRPC routers
// ────────────────────────────────────────────────────────────

export class FeatureGateError extends Error {
  constructor(
    public readonly feature: string,
    public readonly requiredPlan: PlanTier,
    public readonly userPlan: PlanTier
  ) {
    super(
      `Feature "${feature}" requer plano ${requiredPlan}. Plano atual: ${userPlan}.`
    );
    this.name = "FeatureGateError";
  }
}

/**
 * Lança erro se o usuário não tiver acesso à feature
 * Usar dentro de procedures tRPC
 */
export function assertFeature(
  userPlan: PlanTier,
  feature: keyof PlanFeatures
): void {
  if (!hasFeature(userPlan, feature)) {
    const required = minimumPlanForFeature(feature);
    throw new FeatureGateError(feature, required ?? "ELITE", userPlan);
  }
}

/**
 * Lança erro se o usuário excedeu o limite
 */
export function assertLimit(
  userPlan: PlanTier,
  limit: keyof PlanLimits,
  current: number
): void {
  if (!withinLimit(userPlan, limit, current)) {
    const max = PLAN_CONFIGS[userPlan][limit];
    throw new Error(
      `Limite atingido: ${current}/${max} para ${limit}. Faça upgrade do plano.`
    );
  }
}
