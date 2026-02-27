// ============================================================
// PLAN STORE — Zustand
// Armazena o plano do usuário para feature gating client-side
// Hidratado a partir da session do NextAuth
// ============================================================

import { create } from "zustand";
import type { PlanTier } from "@prisma/client";

interface PlanState {
  plan:    PlanTier;
  setPlan: (plan: PlanTier) => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  plan:    "FREE",
  setPlan: (plan) => set({ plan }),
}));
