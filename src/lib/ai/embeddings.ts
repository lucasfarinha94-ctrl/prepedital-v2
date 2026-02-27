// ============================================================
// EMBEDDINGS — Voyage AI (voyage-large-2)
// Parceira oficial da Anthropic | 1536-dim | suporta português
// Grátis: 100M tokens/mês em https://dash.voyageai.com
// ============================================================

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL   = "voyage-large-2"; // 1536 dims, multilingual

/**
 * Gera embedding vetorial de um texto (1536-dim)
 * Retorna string no formato pgvector: "[0.1, 0.2, ...]"
 */
export async function embedText(text: string): Promise<string> {
  const truncated = text.slice(0, 32000); // ~8k tokens

  const res = await fetch(VOYAGE_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: [truncated],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage AI error ${res.status}: ${err}`);
  }

  const json = await res.json() as { data: Array<{ embedding: number[] }> };
  const vector = json.data[0].embedding;

  return `[${vector.join(",")}]`;
}

/**
 * Batch de embeddings (otimizado para indexação em massa)
 * Voyage AI suporta até 128 inputs por request
 */
export async function embedBatch(
  texts: string[],
  batchSize = 64
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.slice(0, 32000));

    const res = await fetch(VOYAGE_API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: batch,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Voyage AI batch error ${res.status}: ${err}`);
    }

    const json = await res.json() as { data: Array<{ embedding: number[] }> };

    for (const item of json.data) {
      results.push(`[${item.embedding.join(",")}]`);
    }

    // Rate limiting entre batches
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}
