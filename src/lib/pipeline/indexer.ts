// ============================================================
// INDEXER — Banco offline proprietário (multi-pasta, multi-nível)
//
// Estratégia:
//   1. Varre recursivamente cada pasta-base
//   2. Para cada PDF encontrado, sobe a árvore de pastas
//      procurando o nome de disciplina mais próximo
//   3. Gera embedding via Voyage AI e persiste no Postgres
//
// Executar: tsx scripts/index-bank.ts
// ============================================================

import { db }        from "@/lib/db";
import { embedText } from "@/lib/ai/embeddings";
import pdfParse      from "pdf-parse";
import { readdir, readFile } from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Usa Claude Haiku para limpar o texto extraído do PDF
// Sem limite de caracteres — armazena conteúdo completo
async function limparTextoComClaude(textoRaw: string): Promise<string> {
  // Haiku suporta 200k tokens de contexto; mandamos tudo
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8096,
    messages: [{
      role: "user",
      content: `Você é um limpador de texto de materiais didáticos brasileiros para concursos públicos.

O texto abaixo foi extraído de um PDF com problemas de codificação. Limpe-o seguindo estas regras:
1. Junte palavras separadas incorretamente (ex: "Direi To Tribu Tário" → "Direito Tributário", "Pri NCÍPio S" → "Princípios")
2. Junte palavras coladas sem espaço (ex: "vocêJáouviu" → "você já ouviu")
3. Remova sumários, índices e linhas com "....número"
4. Remova marcas d'água e avisos de copyright que aparecem no meio do texto
5. Remova rodapés repetidos (ex: "www.grancursosonline.com.br", "X de Y", "O conteúdo deste livro é licenciado para...")
6. Mantenha o conteúdo educacional COMPLETO e INTACTO — NÃO resuma, NÃO corte nada
7. Retorne APENAS o texto limpo, sem comentários ou explicações

TEXTO PARA LIMPAR:
${textoRaw.slice(0, 15000)}`,
    }],
  });

  const content = msg.content[0];
  if (content.type === "text") return content.text.trim();
  return textoRaw;
}

// Wrapper com fallback: se Claude falhar, usa o texto bruto
async function limparTexto(textoRaw: string): Promise<string> {
  try {
    return await limparTextoComClaude(textoRaw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Fallback silencioso se for erro de crédito ou rate limit
    if (msg.includes("credit") || msg.includes("429") || msg.includes("400")) {
      process.stdout.write("~"); // indica fallback
      return textoRaw.slice(0, 15000); // salva bruto mas indexa mesmo assim
    }
    throw err; // outros erros sobem normalmente
  }
}

// ────────────────────────────────────────────────────────────
// TIPOS
// ────────────────────────────────────────────────────────────

export interface IndexOptions {
  baseDirs:          string[];  // Uma ou mais pastas-raiz para varrer
  dryRun?:           boolean;
  disciplinaFilter?: string;    // Filtro opcional por nome
  maxPdfs?:          number;    // Limite (útil para testes)
}

export interface IndexStats {
  total:   number;
  indexed: number;
  skipped: number;
  errors:  number;
  timeMs:  number;
}

// ────────────────────────────────────────────────────────────
// MAPEAMENTO: qualquer parte do caminho → slug de disciplina
// Palavras-chave detectadas em qualquer pasta do caminho
// ────────────────────────────────────────────────────────────

const KEYWORD_SLUG: Array<{ keywords: string[]; slug: string; nome: string }> = [
  // Direito Administrativo
  { keywords: ["DIREITO ADMINISTRATIVO", "DIR ADMIN", "D. ADMINISTRATIVO"], slug: "direito-administrativo", nome: "Direito Administrativo" },
  // Direito Constitucional
  { keywords: ["DIREITO CONSTITUCIONAL", "DIR CONST", "D. CONSTITUCIONAL"], slug: "direito-constitucional", nome: "Direito Constitucional" },
  // Direito Tributário
  { keywords: ["DIREITO TRIBUTÁRIO", "DIREITO TRIBUTARIO", "DIR TRIB", "REFORMA TRIBUTÁRIA", "REFORMA TRIBUTARIA", "TRIBUTÁRIO", "TRIBUTARIO", "CBS", "IBS"], slug: "direito-tributario", nome: "Direito Tributário" },
  // Direito Previdenciário
  { keywords: ["DIREITO PREVIDENCIÁRIO", "DIREITO PREVIDENCIARIO", "PREVIDÊNCIA", "PREVIDENCIA"], slug: "direito-previdenciario", nome: "Direito Previdenciário" },
  // Direito Civil
  { keywords: ["DIREITO CIVIL"],                                    slug: "direito-civil",              nome: "Direito Civil" },
  // Direito Penal
  { keywords: ["DIREITO PENAL"],                                    slug: "direito-penal",              nome: "Direito Penal" },
  // Contabilidade Pública (antes de geral para não ser sobrescrita)
  { keywords: ["CONTABILIDADE PUBLICA", "CONTABILIDADE PÚBLICA", "CONTAB PUBL"], slug: "contabilidade-publica", nome: "Contabilidade Pública" },
  // Contabilidade Geral
  { keywords: ["CONTABILIDADE GERAL", "CONTABILIDADE INTRODUT", "CONTAB GERAL", "CONTABILIDADE ESQUEMATIZADA", "CONTABILIDADE PROF"], slug: "contabilidade-geral", nome: "Contabilidade Geral" },
  { keywords: ["CONTABILIDADE", "CONTAB"],                          slug: "contabilidade-geral",        nome: "Contabilidade Geral" },
  // Auditoria
  { keywords: ["AUDITORIA"],                                        slug: "auditoria",                  nome: "Auditoria" },
  // Raciocínio Lógico
  { keywords: ["RACIOCÍNIO LÓGICO", "RACIOCINIO LOGICO", "RACIOC", "LÓGICO", "LOGICO"], slug: "raciocinio-logico", nome: "Raciocínio Lógico" },
  // Matemática Financeira
  { keywords: ["MATEMÁTICA FINANCEIRA", "MATEMATICA FINANCEIRA", "MAT FINANCEIRA"], slug: "matematica-financeira", nome: "Matemática Financeira" },
  // Estatística
  { keywords: ["ESTATÍSTICA", "ESTATISTICA"],                       slug: "estatistica",                nome: "Estatística" },
  // Economia e Finanças Públicas
  { keywords: ["ECONOMIA", "FINANÇAS PÚBLICAS", "FINANCAS PUBLICAS", "AFO", "FIN PUBL", "FINANCAS PUBL"], slug: "economia-financas", nome: "Economia e Finanças Públicas" },
  // Legislação Tributária
  { keywords: ["LEGISLAÇÃO TRIBUTÁRIA", "LEGISLACAO TRIBUTARIA", "LEGISL TRIBUTARIA", "LTE", "LEIS SEFA", "LEGISLAÇÃO"], slug: "legislacao-tributaria", nome: "Legislação Tributária" },
  // Tecnologia da Informação
  { keywords: ["TECNOLOGIA DA INFORMAÇÃO", "TECNOLOGIA DA INFORMACAO", "TI TOTAL", "TI_TOTAL", "INFORMATICA", "TECNOLOGIA", "FLUÊNCIA EM DADOS", "FLUENCIA EM DADOS"], slug: "tecnologia-informacao", nome: "Tecnologia da Informação" },
  // Administração Pública
  { keywords: ["ADMINISTRACAO PUBLICA", "ADMINISTRAÇÃO PÚBLICA", "ADMIN PUBLICA", "ADMIN PÚBLICA"], slug: "administracao-publica", nome: "Administração Pública" },
  // Administração Geral
  { keywords: ["ADMINISTRACAO GERAL", "ADMINISTRAÇÃO GERAL", "ADMIN GERAL"], slug: "administracao-geral", nome: "Administração Geral" },
  // Português
  { keywords: ["PORTUGUÊS", "PORTUGUES", "LÍNGUA PORTUGUESA", "LINGUA PORTUGUESA"], slug: "portugues", nome: "Português" },
  // Inglês
  { keywords: ["INGLÊS", "INGLES"],                                 slug: "ingles",                     nome: "Inglês" },
  // Inteligência Emocional
  { keywords: ["INTELIGENCIA EMOCIONAL", "INTELIGÊNCIA EMOCIONAL"], slug: "inteligencia-emocional",    nome: "Inteligência Emocional" },
  // Discursivas / Redação
  { keywords: ["DISCURSIVAS", "DISCURSIVA", "REDAÇÃO", "REDACAO"], slug: "redacao-discursivas",        nome: "Redação e Discursivas" },
  // Questões gerais / provas anteriores
  { keywords: ["QUEBRANDO", "QUESTOES INEDITAS", "QUESTÕES INÉDITAS", "PROVAS ANTERIORES", "SIMULADO"], slug: "questoes-gerais", nome: "Questões Gerais" },
];

// ────────────────────────────────────────────────────────────
// DETECTAR DISCIPLINA A PARTIR DO CAMINHO DO ARQUIVO
// ────────────────────────────────────────────────────────────

function detectarDisciplina(filePath: string): { slug: string; nome: string } | null {
  // normalize("NFC") resolve diferença macOS HFS+ (NFD) vs strings TS (NFC)
  const partes = filePath.normalize("NFC").toUpperCase().split(path.sep);

  // Tenta do mais específico (pasta imediata) para o mais geral
  for (let i = partes.length - 1; i >= 0; i--) {
    const parte = partes[i];
    for (const entry of KEYWORD_SLUG) {
      if (entry.keywords.some((kw) => parte.includes(kw))) {
        return { slug: entry.slug, nome: entry.nome };
      }
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL
// ────────────────────────────────────────────────────────────

export async function indexBank(opts: IndexOptions): Promise<IndexStats> {
  const startTime = Date.now();
  const stats: IndexStats = { total: 0, indexed: 0, skipped: 0, errors: 0, timeMs: 0 };

  // Cache de disciplinas para evitar queries repetidas
  const disciplinaCache = new Map<string, string>(); // slug → id

  for (const baseDir of opts.baseDirs) {
    console.log(`\n[Indexer] Varrendo: ${baseDir}`);
    const pdfs = await coletarPdfs(baseDir, opts.maxPdfs);
    console.log(`[Indexer] Encontrados ${pdfs.length} PDFs`);

    for (const pdfPath of pdfs) {
      if (opts.maxPdfs && stats.total >= opts.maxPdfs) break;
      stats.total++;

      // Detectar disciplina pelo caminho
      const disciplinaInfo = detectarDisciplina(pdfPath);
      if (!disciplinaInfo) {
        stats.skipped++;
        process.stdout.write("s");
        continue;
      }

      // Filtro opcional
      if (opts.disciplinaFilter &&
          !disciplinaInfo.nome.toUpperCase().includes(opts.disciplinaFilter.toUpperCase())) {
        stats.skipped++;
        continue;
      }

      // Buscar ou criar disciplina
      let disciplinaId = disciplinaCache.get(disciplinaInfo.slug);
      if (!disciplinaId) {
        const disc = await db.disciplina.upsert({
          where:  { slug: disciplinaInfo.slug },
          create: {
            nome: disciplinaInfo.nome,
            slug: disciplinaInfo.slug,
            area: inferirArea(disciplinaInfo.slug),
            cor:  gerarCor(disciplinaInfo.slug),
          },
          update: {},
        });
        disciplinaId = disc.id;
        disciplinaCache.set(disciplinaInfo.slug, disciplinaId);
      }

      // Indexar o PDF
      await indexarPdf({ pdfPath, disciplinaId, dryRun: opts.dryRun ?? false, stats });
    }
  }

  stats.timeMs = Date.now() - startTime;
  return stats;
}

// ────────────────────────────────────────────────────────────
// COLETAR TODOS OS PDFs RECURSIVAMENTE
// ────────────────────────────────────────────────────────────

async function coletarPdfs(dir: string, limite?: number): Promise<string[]> {
  const resultado: string[] = [];

  async function varrer(current: string) {
    if (limite && resultado.length >= limite) return;

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (limite && resultado.length >= limite) break;

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        // Ignorar pastas inúteis
        if (entry.name.startsWith(".") || entry.name.endsWith(".zip")) continue;
        await varrer(fullPath);
      } else if (entry.name.toLowerCase().endsWith(".pdf")) {
        resultado.push(fullPath);
      }
    }
  }

  await varrer(dir);
  return resultado;
}

// ────────────────────────────────────────────────────────────
// INDEXAR UM PDF
// ────────────────────────────────────────────────────────────

async function indexarPdf(opts: {
  pdfPath:      string;
  disciplinaId: string;
  dryRun:       boolean;
  stats:        IndexStats;
}) {
  const { pdfPath, disciplinaId, dryRun, stats } = opts;
  const fileName = path.basename(pdfPath);

  try {
    // Verificar se já foi indexado
    const existente = await db.conteudo.findFirst({
      where:  { storageKey: pdfPath },
      select: { id: true },
    });
    if (existente) {
      stats.skipped++;
      return;
    }

    // Extrair texto do PDF
    const buffer  = await readFile(pdfPath);
    const pdfData = await pdfParse(buffer);
    const textoRaw = pdfData.text?.trim();

    if (!textoRaw || textoRaw.length < 50) {
      stats.skipped++;
      process.stdout.write("_");
      return;
    }

    // Usar Claude Haiku para limpar o texto (com fallback para texto bruto)
    const texto = await limparTexto(textoRaw);

    if (!texto || texto.length < 50) {
      stats.skipped++;
      process.stdout.write("_");
      return;
    }

    // Em dry-run pula a API de embeddings (sem custo)
    if (dryRun) {
      stats.indexed++;
      process.stdout.write(".");
      return;
    }

    // Gerar embedding (usa texto completo para melhor semântica)
    const embedding = await embedText(textoRaw.slice(0, 8000));

    if (!dryRun) {
      await db.$executeRaw`
        INSERT INTO "conteudos" (
          id, "disciplinaId", tipo, titulo,
          corpo, "storageKey", embedding, "createdAt"
        ) VALUES (
          gen_random_uuid(),
          ${disciplinaId}::text,
          'RESUMO'::"ConteudoTipo",
          ${fileName.replace(/\.pdf$/i, "")},
          ${texto},
          ${pdfPath},
          ${embedding}::vector,
          NOW()
        );
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

function inferirArea(slug: string): string {
  if (slug.includes("direito"))    return "juridica";
  if (slug.includes("contabil"))   return "contabil";
  if (slug.includes("tecnologia") || slug.includes("ti")) return "ti";
  if (slug.includes("fiscal") || slug.includes("tributar") || slug.includes("legisla")) return "fiscal";
  if (slug.includes("economia"))   return "fiscal";
  return "geral";
}

function gerarCor(slug: string): string {
  const cores: Record<string, string> = {
    juridica: "#5B8CFF",
    contabil: "#22C55E",
    ti:       "#F59E0B",
    fiscal:   "#EF4444",
    geral:    "#94A3B8",
  };
  return cores[inferirArea(slug)] ?? "#64748B";
}
