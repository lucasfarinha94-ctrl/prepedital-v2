// ============================================================
// CONTEUDO ROUTER — tRPC
// Materiais por disciplina, busca semântica
// ============================================================

import { z } from "zod";
import { router, editalProcedure } from "@/server/trpc";

export const conteudoRouter = router({

  // ── LISTAR POR DISCIPLINA ────────────────────────────────
  getByDisciplina: editalProcedure
    .input(
      z.object({
        disciplinaId: z.string(),
        tipo:         z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.conteudo.findMany({
        where: {
          disciplinaId: input.disciplinaId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(input.tipo ? { tipo: input.tipo as any } : {}),
        },
        select: {
          id: true, tipo: true, titulo: true, descricao: true,
          duracao: true, fonte: true, storageKey: true, url: true,
          topico: { select: { nome: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // ── BUSCA SEMÂNTICA ──────────────────────────────────────
  // Usa pgvector cosine similarity para encontrar conteúdo relevante
  search: editalProcedure
    .input(z.object({ query: z.string().min(3).max(200) }))
    .query(async ({ ctx, input }) => {
      // 1. Gerar embedding da query via OpenAI
      const { embedText } = await import("@/lib/ai/embeddings");
      const embedding = await embedText(input.query);

      // 2. Busca por similaridade no pgvector
      // Usando raw SQL pois o Prisma ainda não suporta operadores de vetor nativamente
      const results = await ctx.db.$queryRaw<Array<{
        id: string;
        titulo: string;
        descricao: string | null;
        tipo: string;
        similarity: number;
      }>>`
        SELECT
          id, titulo, descricao, tipo,
          1 - (embedding <=> ${embedding}::vector) AS similarity
        FROM conteudos
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${embedding}::vector
        LIMIT 10;
      `;

      return results.filter((r) => r.similarity > 0.7);
    }),
});
