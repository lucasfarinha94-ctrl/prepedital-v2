// ============================================================
// INDEXER — Indexação do banco offline proprietário
//
// Processa a estrutura de pastas do banco local:
// ÁREA FISCAL/GRAN CONCURSOS/[DISCIPLINA]/[arquivos]
// → Extrai texto → Gera embedding → Salva no Postgres
//
// Executar: tsx scripts/index-bank.ts
// ============================================================

import { db }         from "@/lib/db";
import { embedText }  from "@/lib/ai/embeddings";
import pdfParse       from "pdf-parse";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";

// ────────────────────────────────────────────────────────────
// TIPOS
// ────────────────────────────────────────────────────────────

interface IndexOptions {
  baseDir:     string;   // Caminho para a pasta raiz do banco
  dryRun?:     boolean;  // Se true, não persiste no DB
  disciplinaFilter?: string; // Processar apenas uma disciplina
}

interface IndexStats {
  total:      number;
  indexed:    number;
  skipped:    number;
  errors:     number;
  timeMs:     number;
}

// ────────────────────────────────────────────────────────────
// MAPEAMENTO: pasta → disciplina slug
// Ajuste conforme estrutura real do banco offline
// ────────────────────────────────────────────────────────────

const PASTA_PARA_SLUG: Record<string, string> = {
  "DIREITO ADMINISTRATIVO":  "direito-administrativo",
  "DIREITO CONSTITUCIONAL":  "direito-constitucional",
  "DIREITO TRIBUTÁRIO":      "direito-tributario",
  "CONTABILIDADE GERAL":     "contabilidade-geral",
  "CONTABILIDADE PUBLICA":   "contabilidade-publica",
  "RACIOCÍNIO LÓGICO":       "raciocinio-logico",
  "MATEMÁTICA FINANCEIRA":   "matematica-financeira",
  "ESTATÍSTICA":             "estatistica",
  "AUDITORIA":               "auditoria",
  "LEGISLAÇÃO TRIBUTÁRIA":   "legislacao-tributaria",
};

// ────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL DE INDEXAÇÃO
// ────────────────────────────────────────────────────────────

export async function indexBank(opts: IndexOptions): Promise<IndexStats> {
  const startTime = Date.now();
  const stats: IndexStats = { total: 0, indexed: 0, skipped: 0, errors: 0, timeMs: 0 };

  console.log(`[Indexer] Iniciando indexação: ${opts.baseDir}`);

  // Listar pastas de disciplinas
  const entries = await readdir(opts.baseDir, { withFileTypes: true });
  const disciplinaPastas = entries.filter((e) => e.isDirectory());

  for (const pastaEntry of disciplinaPastas) {
    const nomePasta = pastaEntry.name.toUpperCase();

    // Filtro opcional
    if (opts.disciplinaFilter &&
        !nomePasta.includes(opts.disciplinaFilter.toUpperCase())) {
      continue;
    }

    const slug = PASTA_PARA_SLUG[nomePasta];
    if (!slug) {
      console.warn(`[Indexer] Pasta sem mapeamento: ${nomePasta} — ignorando`);
      stats.skipped++;
      continue;
    }

    // Buscar ou criar disciplina no DB
    const disciplina = await db.disciplina.upsert({
      where:  { slug },
      create: {
        nome: nomePasta
          .split(" ")
          .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
          .join(" "),
        slug,
        area: inferirArea(slug),
        cor:  gerarCor(slug),
      },
      update: {},
    });

    const disciplinaDir = path.join(opts.baseDir, pastaEntry.name);
    console.log(`[Indexer] Processando: ${disciplina.nome}`);

    // Indexar arquivos da disciplina recursivamente
    await indexarDiretorio({
      dir:           disciplinaDir,
      disciplinaId:  disciplina.id,
      dryRun:        opts.dryRun ?? false,
      stats,
    });
  }

  stats.timeMs = Date.now() - startTime;
  console.log(
    `[Indexer] Concluído: ${stats.indexed} indexados, ` +
    `${stats.skipped} ignorados, ${stats.errors} erros ` +
    `em ${(stats.timeMs / 1000).toFixed(1)}s`
  );

  return stats;
}

// ────────────────────────────────────────────────────────────
// INDEXAR DIRETÓRIO RECURSIVAMENTE
// ────────────────────────────────────────────────────────────

async function indexarDiretorio(opts: {
  dir:          string;
  disciplinaId: string;
  topicoId?:    string;
  dryRun:       boolean;
  stats:        IndexStats;
}) {
  const { dir, disciplinaId, topicoId, dryRun, stats } = opts;
  let entries: Awaited<ReturnType<typeof readdir>>;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    stats.errors++;
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Sub-pasta = tópico
      const topico = await criarOuBuscarTopico({
        nome:        entry.name,
        disciplinaId,
        parentId:    topicoId,
      });

      await indexarDiretorio({
        dir:          fullPath,
        disciplinaId,
        topicoId:     topico.id,
        dryRun,
        stats,
      });
      continue;
    }

    // Processar arquivo
    stats.total++;
    const ext = path.extname(entry.name).toLowerCase();

    if (ext === ".pdf") {
      await indexarPdf({
        filePath:     fullPath,
        fileName:     entry.name,
        disciplinaId,
        topicoId,
        dryRun,
        stats,
      });
    } else {
      stats.skipped++;
    }
  }
}

// ────────────────────────────────────────────────────────────
// INDEXAR PDF
// ────────────────────────────────────────────────────────────

async function indexarPdf(opts: {
  filePath:     string;
  fileName:     string;
  disciplinaId: string;
  topicoId?:    string;
  dryRun:       boolean;
  stats:        IndexStats;
}) {
  const { filePath, fileName, disciplinaId, topicoId, dryRun, stats } = opts;

  try {
    // Verificar se já foi indexado (por nome de arquivo)
    const existente = await db.conteudo.findFirst({
      where: { storageKey: filePath },
      select: { id: true },
    });

    if (existente) {
      stats.skipped++;
      return;
    }

    // Extrair texto do PDF
    const buffer  = await readFile(filePath);
    const pdfData = await pdfParse(buffer);
    const texto   = pdfData.text.slice(0, 10000); // Primeiros 10k chars

    if (!texto.trim()) {
      stats.skipped++;
      return;
    }

    // Gerar embedding
    const embedding = await embedText(texto.slice(0, 8000));

    if (!dryRun) {
      // Criar conteúdo no DB com embedding
      await db.$executeRaw`
        INSERT INTO conteudos (
          id, disciplina_id, topico_id, tipo, titulo,
          corpo, storage_key, embedding, created_at
        ) VALUES (
          gen_random_uuid(),
          ${disciplinaId},
          ${topicoId ?? null},
          'RESUMO',
          ${fileName.replace(/\.[^.]+$/, "")},
          ${texto.slice(0, 2000)},
          ${filePath},
          ${embedding}::vector,
          NOW()
        )
        ON CONFLICT (storage_key) DO NOTHING;
      `;
    }

    stats.indexed++;
    process.stdout.write(".");

  } catch (err) {
    stats.errors++;
    console.error(`\n[Indexer] Erro em ${fileName}: ${err}`);
  }
}

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

async function criarOuBuscarTopico(opts: {
  nome:         string;
  disciplinaId: string;
  parentId?:    string;
}): Promise<{ id: string }> {
  const slug = opts.nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);

  return db.topico.upsert({
    where: {
      // Usar findFirst já que não há unique composta
      id: (
        await db.topico.findFirst({
          where: { disciplinaId: opts.disciplinaId, slug },
          select: { id: true },
        })
      )?.id ?? "new",
    },
    create: {
      nome:        opts.nome,
      slug,
      disciplinaId: opts.disciplinaId,
      parentId:    opts.parentId ?? null,
      nivel:       opts.parentId ? 2 : 1,
    },
    update: {},
  });
}

function inferirArea(slug: string): string {
  if (slug.includes("direito"))   return "juridica";
  if (slug.includes("contabil"))  return "contabil";
  if (slug.includes("ti") || slug.includes("informatica")) return "ti";
  if (slug.includes("fiscal") || slug.includes("tributar")) return "fiscal";
  return "geral";
}

function gerarCor(slug: string): string {
  // Mapeamento fixo de cores por área
  const cores: Record<string, string> = {
    juridica:  "#5B8CFF",
    contabil:  "#22C55E",
    ti:        "#F59E0B",
    fiscal:    "#EF4444",
    geral:     "#94A3B8",
  };
  return cores[inferirArea(slug)] ?? "#64748B";
}
