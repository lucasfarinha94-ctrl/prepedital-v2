// ============================================================
// OVERVIEW PAGE — Fase 1 (sem edital)
// Estado inerte: sistema aguardando ativação por edital
// ============================================================

"use client";

import { motion } from "framer-motion";
import { Upload, Lock, ArrowRight, FileText, Brain, BarChart2, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";

// ────────────────────────────────────────────────────────────
// FEATURES QUE SERÃO DESBLOQUEADAS
// ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon:        FileText,
    title:       "Conteúdo Mapeado",
    description: "Materiais organizados pelos tópicos exigidos no seu edital específico.",
    locked:      true,
  },
  {
    icon:        Brain,
    title:       "Plano Inteligente",
    description: "Distribuição de estudo calculada por peso, prazo e banca examinadora.",
    locked:      true,
  },
  {
    icon:        BarChart2,
    title:       "Dashboard Estratégico",
    description: "Probabilidade de aprovação atualizada com base na sua performance.",
    locked:      true,
  },
  {
    icon:        Zap,
    title:       "Revisão por IA",
    description: "Repetição espaçada adaptada ao seu ritmo e pontos de atenção.",
    locked:      true,
  },
];

// ────────────────────────────────────────────────────────────
// COMPONENTE
// ────────────────────────────────────────────────────────────

export default function OverviewPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        {/* ── HERO ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="text-center mb-12"
        >
          {/* Ícone central */}
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-xl bg-[#111827] border border-[#1F2937] mb-6">
            <Lock size={28} className="text-[#64748B]" />
          </div>

          <h2 className="text-2xl font-semibold text-[#F8FAFC] mb-3 tracking-tight">
            Sistema inativo
          </h2>
          <p className="text-[#94A3B8] text-base max-w-lg mx-auto leading-relaxed">
            Faça o upload do edital do seu concurso para ativar o ecossistema completo
            de preparação estratégica.
          </p>
        </motion.div>

        {/* ── CTA PRINCIPAL ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
          className="flex justify-center mb-12"
        >
          <Button
            asChild
            size="lg"
            className="glow-pulse gap-2.5"
          >
            <Link href="/upload">
              <Upload size={16} />
              Upload do Edital
              <ArrowRight size={16} />
            </Link>
          </Button>
        </motion.div>

        {/* ── FEATURES BLOQUEADAS ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider text-center mb-5">
            Disponível após ativação
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 + i * 0.06 }}
                  className="stagger-item"
                >
                  <div className="flex items-start gap-4 p-5 rounded-lg bg-[#111827] border border-[#1F2937] opacity-50 select-none">
                    {/* Ícone */}
                    <div className="h-8 w-8 rounded-md bg-[#1E293B] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={15} className="text-[#64748B]" />
                    </div>

                    {/* Texto */}
                    <div>
                      <h3 className="text-[13px] font-semibold text-[#F8FAFC] mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-[12px] text-[#64748B] leading-relaxed">
                        {feature.description}
                      </p>
                    </div>

                    {/* Lock */}
                    <Lock size={12} className="text-[#64748B] ml-auto flex-shrink-0 mt-0.5" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── FORMATOS SUPORTADOS ───────────────────────────── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="text-center text-[11px] text-[#64748B] mt-8"
        >
          Suporta editais em PDF · Processado por IA em instantes
        </motion.p>
      </div>
    </AppShell>
  );
}
