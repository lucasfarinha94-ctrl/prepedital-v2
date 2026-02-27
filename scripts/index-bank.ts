// ============================================================
// SCRIPT: Indexação do banco offline proprietário
//
// Uso:
//   tsx scripts/index-bank.ts                         # tudo
//   tsx scripts/index-bank.ts --dry-run               # simula sem gravar
//   tsx scripts/index-bank.ts --disciplina="AUDITORIA"# só 1 disciplina
//   tsx scripts/index-bank.ts --max=50                # limite p/ testes
// ============================================================

import path from "path";
import fs from "fs";
import { indexBank } from "@/lib/pipeline/indexer";

// Diretório-pai do banco offline (onde estão as pastas ÁREA FISCAL*)
// Por padrão usa a variável de ambiente BANK_ROOT, ou sobe 2 níveis a partir do CWD
const ROOT = process.env.BANK_ROOT
  ?? path.resolve(process.cwd(), "..");

// Todas as pastas do banco offline
const BASE_DIRS = [
  path.join(ROOT, "ÁREA FISCAL"),
  path.join(ROOT, "ÁREA FISCAL 2"),
  path.join(ROOT, "ÁREA FISCAL 3"),
  path.join(ROOT, "ÁREA FISCAL 4"),
  path.join(ROOT, "ÁREA FISCAL 5"),
  path.join(ROOT, "_3_Biblioteca_FAIXA_CINZA"),
].filter((d) => fs.existsSync(d));

// Argumentos
const args        = process.argv.slice(2);
const isDryRun    = args.includes("--dry-run");
const discFlag    = args.find((a) => a.startsWith("--disciplina="));
const maxFlag     = args.find((a) => a.startsWith("--max="));
const discFilter  = discFlag?.split("=")[1];
const maxPdfs     = maxFlag ? parseInt(maxFlag.split("=")[1]) : undefined;

async function main() {
  console.log("=".repeat(60));
  console.log("Indexador de Banco Offline — PrepEdital V2");
  console.log("=".repeat(60));
  console.log(`Pastas encontradas: ${BASE_DIRS.length}`);
  BASE_DIRS.forEach((d) => console.log(`  → ${d}`));
  console.log(`Modo:     ${isDryRun ? "DRY RUN (sem persistência)" : "PRODUÇÃO"}`);
  if (discFilter) console.log(`Filtro:   ${discFilter}`);
  if (maxPdfs)    console.log(`Limite:   ${maxPdfs} PDFs`);
  console.log("=".repeat(60));
  console.log("\n. = indexado  s = sem disciplina mapeada  _ = PDF vazio\n");

  const stats = await indexBank({
    baseDirs:         BASE_DIRS,
    dryRun:           isDryRun,
    disciplinaFilter: discFilter,
    maxPdfs,
  });

  console.log("\n\n" + "=".repeat(60));
  console.log("RESULTADO FINAL:");
  console.log(`  Total PDFs encontrados: ${stats.total}`);
  console.log(`  Indexados:              ${stats.indexed}`);
  console.log(`  Ignorados/sem mapa:     ${stats.skipped}`);
  console.log(`  Erros:                  ${stats.errors}`);
  console.log(`  Tempo total:            ${(stats.timeMs / 1000).toFixed(1)}s`);
  console.log("=".repeat(60));

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
