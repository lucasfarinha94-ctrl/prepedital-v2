// ============================================================
// STATS ROUTER — tRPC
// Métricas do dashboard, evolução, breakdown por disciplina
// ============================================================

import { router, editalProcedure } from "@/server/trpc";
import { z } from "zod";

export const statsRouter = router({

  // ── OVERVIEW — dados do dashboard principal ──────────────
  getOverview: editalProcedure
    .query(async ({ ctx }) => {
      const userId      = ctx.session!.user!.id as string;
      const editalId    = ctx.activeEditalId;
      const seteAnosAtras = new Date();
      seteAnosAtras.setDate(seteAnosAtras.getDate() - 7);

      // Taxa de acerto global (últimos 7 dias)
      const respostas = await ctx.db.resposta.findMany({
        where: { userId, respondidaEm: { gte: seteAnosAtras } },
        select: { correta: true },
      });

      const taxaGlobal = respostas.length > 0
        ? respostas.filter((r) => r.correta).length / respostas.length
        : 0;

      // Questões hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const questoesHoje = await ctx.db.resposta.count({
        where: { userId, respondidaEm: { gte: hoje } },
      });

      // Horas estudadas total
      const sessoes = await ctx.db.sessaoEstudo.findMany({
        where:  { userId, encerradaEm: { not: null } },
        select: { duracaoMin: true },
      });
      const horasEstudadas = sessoes.reduce((acc, s) => acc + (s.duracaoMin ?? 0), 0);

      // Aprovação estimada (heurística simples)
      const aprovacao = Math.round(Math.min(95, taxaGlobal * 100 * 0.9 + 10));

      // Progresso por disciplina
      const progresso = await ctx.db.progressoDisciplina.findMany({
        where: { userId },
        include: { disciplina: { select: { nome: true } } },
        orderBy: { taxaAcerto: "asc" },
      });

      return {
        aprovacao,
        tendencia:  5.2, // TODO: calcular vs semana anterior
        taxaGlobal,
        questoesHoje,
        horasEstudadas,
        disciplinas: progresso.map((p) => ({
          nome:     p.disciplina.nome,
          acerto:   p.taxaAcerto,
          questoes: p.totalQuestoes,
        })),
        evolucao: [], // TODO: calcular séries temporais semanais
      };
    }),

  // ── POR DISCIPLINA ───────────────────────────────────────
  getByDisciplina: editalProcedure
    .input(z.object({ disciplinaId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id as string;

      const p = await ctx.db.progressoDisciplina.findUnique({
        where: { userId_disciplinaId: { userId, disciplinaId: input.disciplinaId } },
      });

      return p;
    }),
});
