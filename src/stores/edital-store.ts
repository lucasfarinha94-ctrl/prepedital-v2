// ============================================================
// EDITAL STORE — Zustand
// Estado global do edital ativo
// Persiste no cookie para o middleware Edge ler
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface EditalAtivo {
  id:            string;
  banca:         string;
  orgao:         string;
  cargo:         string;
  dataProva?:    string; // ISO date string
  totalQuestoes?: number;
  disciplinas:   Array<{
    id:          string;
    nome:        string;
    peso:        number;
    numQuestoes: number;
  }>;
}

export type ProcessingStatus =
  | "idle"
  | "uploading"
  | "queued"
  | "parsing"
  | "mapping"
  | "planning"
  | "done"
  | "error";

interface EditalState {
  // Edital ativo
  activeEdital:     EditalAtivo | null;
  editais:          EditalAtivo[];       // histórico do usuário

  // Processamento em curso
  isProcessing:     boolean;
  processingStatus: ProcessingStatus;
  processingProgress: number;            // 0-100
  processingStep:   string;             // descrição textual da etapa
  jobId:            string | null;      // ID do job na fila

  // Actions
  setActiveEdital:      (edital: EditalAtivo | null) => void;
  addEdital:            (edital: EditalAtivo) => void;
  setProcessing:        (status: ProcessingStatus, progress?: number, step?: string) => void;
  setJobId:             (id: string | null) => void;
  reset:                () => void;
}

// Estado inicial
const initialState = {
  activeEdital:       null,
  editais:            [],
  isProcessing:       false,
  processingStatus:   "idle" as ProcessingStatus,
  processingProgress: 0,
  processingStep:     "",
  jobId:              null,
};

export const useEditalStore = create<EditalState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setActiveEdital: (edital) => {
        set({ activeEdital: edital });

        // Sincroniza com cookie para o middleware Edge
        if (typeof document !== "undefined") {
          if (edital) {
            // Cookie expira em 30 dias
            const expires = new Date();
            expires.setDate(expires.getDate() + 30);
            document.cookie = `active-edital-id=${edital.id}; path=/; expires=${expires.toUTCString()}; SameSite=Strict`;
          } else {
            // Remove cookie
            document.cookie = "active-edital-id=; path=/; max-age=0";
          }
        }
      },

      addEdital: (edital) =>
        set((s) => ({
          editais: [edital, ...s.editais.filter((e) => e.id !== edital.id)],
        })),

      setProcessing: (status, progress = 0, step = "") =>
        set({
          isProcessing:       status !== "idle" && status !== "done" && status !== "error",
          processingStatus:   status,
          processingProgress: progress,
          processingStep:     step,
        }),

      setJobId: (id) => set({ jobId: id }),

      reset: () => set(initialState),
    }),
    {
      name: "edital-store",
      // Não persiste estado transitório de processamento
      partialize: (state) => ({
        activeEdital: state.activeEdital,
        editais:      state.editais,
      }),
    }
  )
);

// ── COMPUTED SELECTORS ─────────────────────────────────────

/** True se há um edital ativo válido */
export const selectHasEdital = (s: EditalState) => !!s.activeEdital;

/** Retorna a lista de disciplinas do edital ativo ordenada por peso */
export const selectDisciplinasOrdenadas = (s: EditalState) =>
  s.activeEdital?.disciplinas
    .slice()
    .sort((a, b) => b.peso - a.peso) ?? [];
