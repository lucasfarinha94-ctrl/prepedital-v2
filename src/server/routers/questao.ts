// ============================================================
// QUESTAO ROUTER — tRPC
// Listar, responder, busca semântica
// ============================================================

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, editalProcedure } from "@/server/trpc";
import { assertLimit } from "@/lib/feature-gating";

export const questaoRouter = router({

  // ── LISTAR ──────────────────────────────────────────────
  list: editalProcedure
    .input(
      z.object({
        disciplinaId: z.string().optional(),
        topicoId:     z.string().optional(),
        dificuldade:  z.enum(["FACIL", "MEDIO", "DIFICIL"]).optional(),
        banca:        z.string().optional(),
        page:         z.number().int().min(1).default(1),
        limit:        z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;

      // Verificar limite diário do plano
      const user = await ctx.db.user.findUnique({
        where: { id: userId }, select: { plan: true },
      });
      const planLimits = { FREE: 30, PRO: 200, ELITE: -1, FOUNDER: -1 };
      const maxHoje = planLimits[(user?.plan ?? "FREE") as keyof typeof planLimits];

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const respostasHoje = await ctx.db.resposta.count({
        where: { userId, respondidaEm: { gte: hoje } },
      });
      assertLimit(user?.plan ?? "FREE" as Parameters<typeof assertLimit>[0], "maxQuestoesDia", respostasHoje);

      const [questoes, total] = await ctx.db.$transaction([
        ctx.db.questao.findMany({
          where: {
            disciplinaId: input.disciplinaId,
            topicoId:     input.topicoId,
            dificuldade:  input.dificuldade,
            banca:        input.banca,
          },
          select: {
            id: true, enunciado: true, alternativas: true,
            dificuldade: true, banca: true, ano: true,
            disciplina: { select: { nome: true } },
            topico:     { select: { nome: true } },
            taxaAcerto: true,
          },
          skip:    (input.page - 1) * input.limit,
          take:    input.limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.questao.count({
          where: {
            disciplinaId: input.disciplinaId,
            topicoId:     input.topicoId,
            dificuldade:  input.dificuldade,
          },
        }),
      ]);

      return {
        questoes,
        total,
        pages: Math.ceil(total / input.limit),
        page:  input.page,
      };
    }),

  // ── RESPONDER ────────────────────────────────────────────
  answer: editalProcedure
    .input(
      z.object({
        questaoId:          z.string(),
        respostaAlternativa: z.string(),
        tempoSegundos:      z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;

      const questao = await ctx.db.questao.findUnique({
        where:  { id: input.questaoId },
        select: { gabarito: true, disciplinaId: true },
      });

      if (!questao) throw new TRPCError({ code: "NOT_FOUND" });

      const correta =
        input.respostaAlternativa.toLowerCase() === questao.gabarito.toLowerCase();

      // Registrar resposta
      await ctx.db.resposta.create({
        data: {
          userId,
          questaoId:           input.questaoId,
          respostaAlternativa: input.respostaAlternativa,
          correta,
          tempoSegundos:       input.tempoSegundos,
        },
      });

      // Atualizar stats da questão (desnormalizado)
      await ctx.db.questao.update({
        where: { id: input.questaoId },
        data: {
          totalRespostas: { increment: 1 },
          totalAcertos:   { increment: correta ? 1 : 0 },
        },
      });

      // Atualizar progresso da disciplina
      const prog = await ctx.db.progressoDisciplina.upsert({
        where: {
          userId_disciplinaId: { userId, disciplinaId: questao.disciplinaId },
        },
        create: {
          userId,
          disciplinaId:   questao.disciplinaId,
          totalQuestoes:  1,
          totalAcertos:   correta ? 1 : 0,
          taxaAcerto:     correta ? 1.0 : 0.0,
          ultimaAtividade: new Date(),
        },
        update: {
          totalQuestoes:   { increment: 1 },
          totalAcertos:    { increment: correta ? 1 : 0 },
          ultimaAtividade: new Date(),
        },
      });

      // Recalcular taxa
      if (prog.totalQuestoes > 0) {
        await ctx.db.progressoDisciplina.update({
          where: {
            userId_disciplinaId: { userId, disciplinaId: questao.disciplinaId },
          },
          data: {
            taxaAcerto: prog.totalAcertos / prog.totalQuestoes,
          },
        });
      }

      return { correta, gabarito: questao.gabarito };
    }),
});
