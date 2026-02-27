# Sistema de Preparação V2 — Arquitetura

## Visão Geral

Sistema SaaS de preparação estratégica para concursos públicos.
**Princípio central**: O sistema é inerte sem edital. O upload ativa todo o ecossistema.

---

## Fluxo de Ativação

```
Upload PDF → Supabase Storage
          → Job Queue (Upstash QStash)
          → Claude API (extração estruturada)
          → Cruzamento com banco offline
          → Geração de plano por IA
          → Status: ACTIVE → Dashboard desbloqueado
```

---

## Estrutura de Pastas

```
sistema-v2/
├── prisma/
│   └── schema.prisma          # Schema completo PostgreSQL + pgvector
│
├── scripts/
│   ├── index-bank.ts          # Indexa banco offline → embeddings
│   └── migrate-v1-to-v2.ts   # Migração V1 → V2 + seed
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout + providers
│   │   ├── globals.css                   # Design tokens CSS
│   │   ├── (fase-1)/
│   │   │   ├── overview/page.tsx         # Estado inerte (sem edital)
│   │   │   └── upload/page.tsx           # Upload + pipeline status
│   │   ├── (fase-2)/
│   │   │   ├── dashboard/page.tsx        # Métricas + foco do dia
│   │   │   ├── conteudo/page.tsx         # Materiais por disciplina
│   │   │   ├── questoes/page.tsx         # Banco de questões
│   │   │   ├── simulados/page.tsx        # Simulados (PRO+)
│   │   │   ├── revisao/page.tsx          # Revisão IA (PRO+)
│   │   │   └── estatisticas/page.tsx     # Analytics
│   │   └── api/
│   │       ├── trpc/[trpc]/route.ts      # tRPC handler
│   │       ├── edital/status/route.ts    # Polling de processamento
│   │       └── auth/[...nextauth]/route.ts
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-shell.tsx             # Wrapper: Sidebar + Header + Main
│   │   │   ├── sidebar.tsx               # Nav com feature gating visual
│   │   │   └── header.tsx                # Contextual: edital ativo + user
│   │   ├── ui/
│   │   │   ├── button.tsx                # primary | secondary | ghost | danger
│   │   │   ├── card.tsx                  # base | raised | hero
│   │   │   └── ...                       # badge, progress, input, etc.
│   │   └── providers.tsx                 # SessionProvider + tRPC + Zustand sync
│   │
│   ├── server/
│   │   ├── trpc.ts                       # Contexto + procedure builders
│   │   └── routers/
│   │       ├── _app.ts                   # Router raiz
│   │       ├── edital.ts                 # Upload, status, archive
│   │       ├── stats.ts                  # Métricas do dashboard
│   │       ├── plano.ts                  # Plano de estudos + foco
│   │       ├── questao.ts                # Listar + responder
│   │       └── conteudo.ts               # Materiais + busca semântica
│   │
│   ├── lib/
│   │   ├── db.ts                         # Prisma singleton
│   │   ├── auth.ts                       # NextAuth config
│   │   ├── trpc.ts                       # tRPC React client
│   │   ├── utils.ts                      # Helpers (cn, pct, etc.)
│   │   ├── feature-gating.ts             # Planos + gates + assertions
│   │   ├── pipeline/
│   │   │   ├── edital-processor.ts       # Pipeline completo (PDF→ACTIVE)
│   │   │   └── indexer.ts                # Indexação do banco offline
│   │   └── ai/
│   │       └── embeddings.ts             # OpenAI embeddings + batch
│   │
│   ├── stores/
│   │   ├── edital-store.ts               # Edital ativo (Zustand + persist)
│   │   └── plan-store.ts                 # Plano do usuário (Zustand)
│   │
│   ├── types/                            # TypeScript types globais
│   └── middleware.ts                     # Auth + Edital Guard + Feature Gate
```

---

## Camadas de Middleware

```
Request
  │
  ▼
[1] Autenticação (JWT NextAuth)
  │  └── Não autenticado → /login
  │
  ▼
[2] Edital Guard (cookie active-edital-id)
  │  └── Rotas fase-2 sem edital → /upload?reason=edital-required
  │
  ▼
[3] Feature Gate (JWT claim: plan)
  │  └── Feature bloqueada → /pricing?feature=X&required=pro
  │
  ▼
Handler
```

---

## Feature Gating

| Feature          | FREE | PRO | ELITE | FOUNDER |
|------------------|------|-----|-------|---------|
| Editais          | 1    | 3   | ∞     | ∞       |
| Questões/dia     | 30   | 200 | ∞     | ∞       |
| Simulados        | ✗    | ✓   | ✓     | ✓       |
| Revisão IA       | ✗    | ✓   | ✓     | ✓       |
| PDF Export       | ✗    | ✓   | ✓     | ✓       |
| Banco Completo   | ✗    | ✗   | ✓     | ✓       |
| Rel. Avançados   | ✗    | ✗   | ✓     | ✓       |
| Debug Tools      | ✗    | ✗   | ✗     | ✓       |

---

## Pipeline de Processamento de Edital

```
1. UPLOADING  (0-15%)   → PDF enviado para Supabase Storage
2. QUEUED     (15-25%)  → Job publicado no Upstash QStash
3. PARSING    (25-55%)  → Claude API extrai JSON estruturado
4. MAPPING    (55-75%)  → Disciplinas cruzadas com banco offline
5. PLANNING   (75-90%)  → Plano de estudos gerado por IA
6. ACTIVE     (100%)    → Sistema completamente ativado
```

### Schema Claude (output estruturado):
```json
{
  "banca": "CESPE",
  "orgao": "SEFAZ-PA",
  "cargo": "Auditor Fiscal da Receita Estadual",
  "totalQuestoes": 120,
  "disciplinas": [
    {
      "nome": "Direito Tributário",
      "peso": 0.25,
      "numQuestoes": 30,
      "topicos": ["ICMS", "ISS", "Obrigação Tributária"]
    }
  ]
}
```

---

## Banco Vetorial (pgvector)

- Modelo: `text-embedding-3-small` (OpenAI) — 1536 dimensões
- Índice: IVFFlat com 100 listas (busca aproximada ~10ms)
- Operador: cosine similarity (`<=>`)
- Threshold: similarity > 0.70 para resultados relevantes

### Busca semântica:
```sql
SELECT titulo, 1 - (embedding <=> $1::vector) AS similarity
FROM conteudos
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

---

## Primeiros Passos

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env
# edite .env com suas chaves

# 3. Sincronizar schema com DB
npm run db:push

# 4. Migração inicial (seed de planos + disciplinas)
npm run db:seed
# ou
tsx scripts/migrate-v1-to-v2.ts

# 5. Indexar banco offline (opcional, pode demorar)
npm run index:bank

# 6. Iniciar desenvolvimento
npm run dev
```

---

## Decisões de Arquitetura

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| API Layer | tRPC | Type-safety fim-a-fim, sem geração de código |
| State | Zustand | Leve, sem boilerplate, persist para cookie |
| Auth | NextAuth JWT | Compatible com Edge Runtime |
| Queue | Upstash QStash | Serverless, sem infra adicional |
| Storage | Supabase | pgvector nativo, Storage, Auth integrados |
| Embeddings | OpenAI text-embedding-3-small | Custo-benefício, 1536-dim |
| LLM | Claude Opus 4.5 | Melhor compreensão de documentos jurídicos |
