// ============================================================
// PLANO ROUTER — tRPC
// Plano de estudos ativo, foco do dia, marcar concluído
// ============================================================

import { z } from "zod";
import { router, editalProcedure } from "@/server/trpc";

export const planoRouter = router({

  // ── PLANO ATIVO ──────────────────────────────────────────
  getActive: editalProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id as string;
      return ctx.db.planoEstudo.findFirst({
        where:   { userId, ativo: true },
        include: { dias: { take: 7, orderBy: { data: "asc" } } },
      });
    }),

  // ── FOCO DO DIA ──────────────────────────────────────────
  getDiaAtual: editalProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id as string;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const plano = await ctx.db.planoEstudo.findFirst({
        where: { userId, ativo: true },
        select: { id: true },
      });

      if (!plano) return null;

      const dia = await ctx.db.planoDia.findUnique({
        where: { planoId_data: { planoId: plano.id, data: hoje } },
      });

      return {
        data:   hoje.toLocaleDateString("pt-BR", {
          weekday: "long", day: "numeric", month: "long",
        }),
        concluido: dia?.concluido ?? false,
        itens:    (dia?.itensJson ?? []) as Array<{
          tipo: string;
          disciplina: string;
          topico: string;
          duracaoMin: number;
        }>,
      };
    }),

  // ── MARCAR CONCLUÍDO ─────────────────────────────────────
  marcarConcluido: editalProcedure
    .input(z.object({ planoId: z.string(), data: z.date() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.planoDia.update({
        where: { planoId_data: { planoId: input.planoId, data: input.data } },
        data:  { concluido: true, concluidoEm: new Date() },
      });
      return { success: true };
    }),
});
