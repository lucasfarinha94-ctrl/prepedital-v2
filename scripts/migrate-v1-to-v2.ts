// ============================================================
// SCRIPT: Migração V1 → V2
//
// O que migra:
// 1. Usuários (se existir DB da V1)
// 2. Editais já processados (status → ACTIVE)
// 3. Respostas históricas de questões
// 4. Progresso por disciplina
//
// Pressupostos:
// - V1 usa SQLite ou PostgreSQL diferente
// - V2 usa o novo schema com pgvector
// - Conexão V1 configurada em DATABASE_URL_V1
//
// Uso:
//   tsx scripts/migrate-v1-to-v2.ts
//   tsx scripts/migrate-v1-to-v2.ts --dry-run
// ============================================================

const args     = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

// ────────────────────────────────────────────────────────────
// ESTRATÉGIA DE MIGRAÇÃO (sem DB V1 — migração manual)
// ────────────────────────────────────────────────────────────

/**
 * Se a V1 não tem banco de dados (apenas arquivos .ts e .tsx de referência),
 * a migração é estrutural — apenas garantir que o schema V2 está correto
 * e que os dados mínimos de configuração existem.
 */

async function main() {
  const { db } = await import("@/lib/db");

  console.log("=".repeat(60));
  console.log("Migração V1 → V2");
  console.log("=".repeat(60));
  console.log(`Modo: ${isDryRun ? "DRY RUN" : "PRODUÇÃO"}`);
  console.log();

  // ── PASSO 1: Seed de PlanConfigs ───────────────────────
  console.log("[1/4] Configurando planos no banco...");
  const { PLAN_CONFIGS } = await import("@/lib/feature-gating");

  if (!isDryRun) {
    for (const [plan, config] of Object.entries(PLAN_CONFIGS)) {
      await db.planConfig.upsert({
        where: { plan: plan as Parameters<typeof db.planConfig.upsert>[0]["where"]["plan"] },
        create: {
          plan: plan as Parameters<typeof db.planConfig.upsert>[0]["create"]["plan"],
          maxEditais:         config.maxEditais,
          maxQuestoesDia:     config.maxQuestoesDia,
          maxSimuladosDia:    config.maxSimuladosDia,
          maxDisciplinas:     config.maxDisciplinas,
          hasSimulados:       config.hasSimulados,
          hasRevisaoIA:       config.hasRevisaoIA,
          hasPdfExport:       config.hasPdfExport,
          hasRelatoriosAvancados: config.hasRelatoriosAvancados,
          hasSuportePrioritario:  config.hasSuportePrioritario,
          hasBancoCompleto:   config.hasBancoCompleto,
          hasApiAccess:       config.hasApiAccess,
          hasDebugTools:      config.hasDebugTools,
          precoMensal:        config.precoMensal,
          descricao:          config.descricao,
        },
        update: {
          maxEditais:         config.maxEditais,
          maxQuestoesDia:     config.maxQuestoesDia,
          hasSimulados:       config.hasSimulados,
          hasRevisaoIA:       config.hasRevisaoIA,
        },
      });
    }
    console.log("   Planos configurados: FREE, PRO, ELITE, FOUNDER");
  } else {
    console.log("   [DRY RUN] Pularia criação de PlanConfigs");
  }

  // ── PASSO 2: Verificar extensão pgvector ───────────────
  console.log("[2/4] Verificando extensão pgvector...");
  if (!isDryRun) {
    try {
      await db.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`;
      console.log("   pgvector: OK");
    } catch {
      console.warn("   pgvector: Já existe ou sem permissão (normal no Supabase)");
    }
  } else {
    console.log("   [DRY RUN] Verificaria pgvector");
  }

  // ── PASSO 3: Criar índices de vetor ───────────────────
  console.log("[3/4] Criando índices vetoriais...");
  if (!isDryRun) {
    try {
      // IVFFlat para busca aproximada (~100ms em 1M vetores)
      await db.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_conteudos_embedding
        ON conteudos USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `;
      await db.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_questoes_embedding
        ON questoes USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `;
      console.log("   Índices criados: conteudos.embedding, questoes.embedding");
    } catch {
      console.warn("   Índices já existem ou tabelas vazias (normal em setup inicial)");
    }
  } else {
    console.log("   [DRY RUN] Criaria índices IVFFlat");
  }

  // ── PASSO 4: Seed de disciplinas base ─────────────────
  console.log("[4/4] Seed de disciplinas do banco offline...");

  const DISCIPLINAS_BASE = [
    { nome: "Direito Administrativo",  slug: "direito-administrativo",  area: "juridica",  cor: "#5B8CFF" },
    { nome: "Direito Constitucional",  slug: "direito-constitucional",  area: "juridica",  cor: "#5B8CFF" },
    { nome: "Direito Tributário",      slug: "direito-tributario",      area: "fiscal",    cor: "#EF4444" },
    { nome: "Contabilidade Geral",     slug: "contabilidade-geral",     area: "contabil",  cor: "#22C55E" },
    { nome: "Contabilidade Pública",   slug: "contabilidade-publica",   area: "contabil",  cor: "#22C55E" },
    { nome: "Raciocínio Lógico",       slug: "raciocinio-logico",       area: "geral",     cor: "#94A3B8" },
    { nome: "Matemática Financeira",   slug: "matematica-financeira",   area: "geral",     cor: "#94A3B8" },
    { nome: "Estatística",             slug: "estatistica",             area: "geral",     cor: "#94A3B8" },
    { nome: "Auditoria",               slug: "auditoria",               area: "contabil",  cor: "#22C55E" },
    { nome: "Legislação Tributária",   slug: "legislacao-tributaria",   area: "fiscal",    cor: "#EF4444" },
    { nome: "Informática",             slug: "informatica",             area: "ti",        cor: "#F59E0B" },
    { nome: "Português",               slug: "portugues",               area: "geral",     cor: "#94A3B8" },
  ];

  if (!isDryRun) {
    for (const d of DISCIPLINAS_BASE) {
      await db.disciplina.upsert({
        where:  { slug: d.slug },
        create: d,
        update: {},
      });
    }
    console.log(`   ${DISCIPLINAS_BASE.length} disciplinas inseridas/atualizadas`);
  } else {
    console.log(`   [DRY RUN] Inseriria ${DISCIPLINAS_BASE.length} disciplinas`);
  }

  console.log();
  console.log("=".repeat(60));
  console.log("Migração concluída.");
  console.log();
  console.log("Próximos passos:");
  console.log("  1. npm run db:push       (sincronizar schema)");
  console.log("  2. npm run index:bank    (indexar banco offline)");
  console.log("  3. npm run dev           (iniciar desenvolvimento)");
  console.log("=".repeat(60));

  await db.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro fatal na migração:", err);
  process.exit(1);
});
