// ============================================================
// EDITAL ROUTER — tRPC
// Upload, status, ativação, listagem
// ============================================================

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { createEditalJob } from "@/lib/pipeline/edital-processor";
import crypto from "crypto";

export const editalRouter = router({

  // ── UPLOAD — recebe PDF em base64, cria job ──────────────
  upload: protectedProcedure
    .input(
      z.object({
        fileName:   z.string().max(255),
        fileSize:   z.number().max(50 * 1024 * 1024), // 50MB max
        fileBase64: z.string(),                        // PDF em base64
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;

      // Verificar limite do plano
      const user = await ctx.db.user.findUnique({
        where:  { id: userId },
        select: { plan: true },
      });

      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const planLimits = { FREE: 1, PRO: 3, ELITE: -1, FOUNDER: -1 };
      const maxEditais = planLimits[user.plan] ?? 1;

      if (maxEditais !== -1) {
        const count = await ctx.db.edital.count({
          where: { userId, status: { not: "ARCHIVED" } },
        });
        if (count >= maxEditais) {
          throw new TRPCError({
            code:    "FORBIDDEN",
            message: `Limite de ${maxEditais} edital(is) atingido para o plano ${user.plan}. Faça upgrade para continuar.`,
          });
        }
      }

      // Hash para deduplicação
      const buffer = Buffer.from(input.fileBase64, "base64");
      const hash   = crypto.createHash("md5").update(buffer).digest("hex");

      // Verificar se edital duplicado (mesmo hash, mesmo usuário)
      const existing = await ctx.db.edital.findFirst({
        where: { userId, hashMd5: hash, status: "ACTIVE" },
      });

      if (existing) {
        throw new TRPCError({
          code:    "CONFLICT",
          message: "Este edital já foi importado anteriormente.",
        });
      }

      // Upload para Supabase Storage (implementação real)
      // Em dev, simular com storage key fictícia
      const storageKey = `editais/${userId}/${Date.now()}-${input.fileName}`;

      // Criar registro do edital
      const edital = await ctx.db.edital.create({
        data: {
          userId,
          nomeArquivo:  input.fileName,
          storageKey,
          tamanhoBytes: input.fileSize,
          hashMd5:      hash,
          status:       "QUEUED",
        },
      });

      // Enfileirar job de processamento
      const job = await createEditalJob({
        editalId: edital.id,
        userId,
        fileBase64: input.fileBase64,
      });

      // Criar registro de job
      await ctx.db.processingJob.create({
        data: {
          editalId: edital.id,
          status:   "QUEUED",
        },
      });

      return {
        editalId: edital.id,
        jobId:    job.id,
        status:   "QUEUED",
      };
    }),

  // ── STATUS — polling do progresso ───────────────────────
  getStatus: protectedProcedure
    .input(z.object({ editalId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;

      const edital = await ctx.db.edital.findFirst({
        where: { id: input.editalId, userId },
        include: {
          disciplinas: {
            select: {
              id: true, nome: true, peso: true, numQuestoes: true,
            },
          },
        },
      });

      if (!edital) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const job = await ctx.db.processingJob.findFirst({
        where:   { editalId: edital.id },
        orderBy: { createdAt: "desc" },
      });

      return {
        status:       edital.status,
        errorMessage: edital.errorMessage,
        progresso:    job?.progresso ?? 0,
        etapa:        job?.etapa ?? "",
        edital: edital.status === "ACTIVE" ? {
          id:           edital.id,
          banca:        edital.banca,
          orgao:        edital.orgao,
          cargo:        edital.cargo,
          dataProva:    edital.dataProva?.toISOString(),
          totalQuestoes:edital.totalQuestoes,
          disciplinas:  edital.disciplinas,
        } : null,
      };
    }),

  // ── EDITAL ATIVO ─────────────────────────────────────────
  getActive: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id as string;

      const edital = await ctx.db.edital.findFirst({
        where: { userId, status: "ACTIVE" },
        include: {
          disciplinas: {
            select: {
              id: true, nome: true, peso: true, numQuestoes: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      if (!edital) return null;

      return {
        id:            edital.id,
        banca:         edital.banca ?? "",
        orgao:         edital.orgao ?? "",
        cargo:         edital.cargo ?? "",
        dataProva:     edital.dataProva?.toISOString(),
        totalQuestoes: edital.totalQuestoes,
        disciplinas:   edital.disciplinas,
      };
    }),

  // ── LISTAGEM ─────────────────────────────────────────────
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id as string;
      return ctx.db.edital.findMany({
        where:   { userId },
        select: {
          id: true, banca: true, orgao: true, cargo: true,
          status: true, dataProva: true, nomeArquivo: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // ── ARQUIVAR ─────────────────────────────────────────────
  archive: protectedProcedure
    .input(z.object({ editalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id as string;
      await ctx.db.edital.updateMany({
        where: { id: input.editalId, userId },
        data:  { status: "ARCHIVED" },
      });
      return { success: true };
    }),
});
