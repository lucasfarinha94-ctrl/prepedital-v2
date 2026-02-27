// ============================================================
// EMBEDDINGS — OpenAI text-embedding-3-small
// 1536 dimensões, compatível com pgvector
// ============================================================

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Gera embedding vetorial de um texto (1536-dim)
 * Retorna string no formato pgvector: "[0.1, 0.2, ...]"
 */
export async function embedText(text: string): Promise<string> {
  // Truncar se necessário (máximo ~8k tokens para text-embedding-3-small)
  const truncated = text.slice(0, 30000);

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: truncated,
    dimensions: 1536,
  });

  const vector = response.data[0].embedding;

  // Formatar como string pgvector
  return `[${vector.join(",")}]`;
}

/**
 * Batch de embeddings (otimizado para indexação em massa)
 * Respeita rate limit da API
 */
export async function embedBatch(
  texts: string[],
  batchSize = 20
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch.map((t) => t.slice(0, 30000)),
      dimensions: 1536,
    });

    for (const item of response.data) {
      results.push(`[${item.embedding.join(",")}]`);
    }

    // Rate limiting: 100ms entre batches em produção
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return results;
}
