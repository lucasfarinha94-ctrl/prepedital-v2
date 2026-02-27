// ============================================================
// SCRIPT: Indexação do banco offline proprietário
//
// Uso:
//   tsx scripts/index-bank.ts
//   tsx scripts/index-bank.ts --dry-run
//   tsx scripts/index-bank.ts --disciplina "DIREITO ADMINISTRATIVO"
//
// O script varre as pastas de conteúdo, extrai texto dos PDFs,
// gera embeddings e persiste no Postgres com pgvector.
// ============================================================

import path from "path";
import { indexBank } from "@/lib/pipeline/indexer";

// Caminho base do banco offline (relativo ao projeto)
const BASE_DIR = path.join(
  process.env.BANK_DIR ?? "../ÁREA FISCAL"
);

const args     = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const discFlag = args.find((a) => a.startsWith("--disciplina="));
const discFilter = discFlag?.split("=")[1];

async function main() {
  console.log("=".repeat(60));
  console.log("Indexador de Banco Offline — Sistema V2");
  console.log("=".repeat(60));
  console.log(`Diretório: ${BASE_DIR}`);
  console.log(`Modo:      ${isDryRun ? "DRY RUN (sem persistência)" : "PRODUÇÃO"}`);
  if (discFilter) console.log(`Filtro:    ${discFilter}`);
  console.log("=".repeat(60));
  console.log();

  const stats = await indexBank({
    baseDir:           BASE_DIR,
    dryRun:            isDryRun,
    disciplinaFilter:  discFilter,
  });

  console.log("\n" + "=".repeat(60));
  console.log("RESULTADO:");
  console.log(`  Total processado: ${stats.total}`);
  console.log(`  Indexados:        ${stats.indexed}`);
  console.log(`  Ignorados:        ${stats.skipped}`);
  console.log(`  Erros:            ${stats.errors}`);
  console.log(`  Tempo:            ${(stats.timeMs / 1000).toFixed(1)}s`);
  console.log("=".repeat(60));

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
