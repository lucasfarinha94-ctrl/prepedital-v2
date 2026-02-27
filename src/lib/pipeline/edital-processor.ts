// ============================================================
// EDITAL PROCESSOR — Pipeline de processamento
//
// Fluxo:
// 1. Extrair texto do PDF (pdf-parse)
// 2. Claude API → parse estruturado do edital
// 3. Cruzar disciplinas com banco offline (fuzzy match)
// 4. Gerar plano de estudos por IA
// 5. Atualizar status no DB a cada etapa
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { db }    from "@/lib/db";
import pdfParse  from "pdf-parse";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ────────────────────────────────────────────────────────────
// TIPOS
// ────────────────────────────────────────────────────────────

interface EditalMetadados {
  banca:         string;
  orgao:         string;
  cargo:         string;
  editalNumero:  string;
  dataPublicacao?: string;
  dataProva?:    string;
  salario?:      number;
  vagas?:        number;
  totalQuestoes: number;
  disciplinas: Array<{
    nome:       string;
    peso:       number;       // % de questões
    numQuestoes:number;
    topicos:    string[];
  }>;
}

interface JobInput {
  editalId:   string;
  userId:     string;
  fileBase64: string;
}

// ────────────────────────────────────────────────────────────
// ENFILEIRAR JOB
// Para Upstash QStash em produção; síncrono em dev
// ────────────────────────────────────────────────────────────

export async function createEditalJob(input: JobInput): Promise<{ id: string }> {
  const jobId = `job_${Date.now()}_${input.editalId}`;

  if (process.env.NODE_ENV === "production" && process.env.QSTASH_URL) {
    // Publicar para Upstash QStash → endpoint /api/edital/process
    const { Client } = await import("@upstash/qstash");
    const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

    await qstash.publishJSON({
      url:  `${process.env.NEXTAUTH_URL}/api/edital/process`,
      body: { ...input, jobId },
    });
  } else {
    // Dev: processar de forma assíncrona sem bloquear a resposta
    setImmediate(() => processEdital({ ...input, jobId }));
  }

  return { id: jobId };
}

// ────────────────────────────────────────────────────────────
// PROCESSAMENTO PRINCIPAL
// ────────────────────────────────────────────────────────────

export async function processEdital(input: JobInput & { jobId: string }) {
  const { editalId, userId, fileBase64, jobId } = input;

  const updateJob = async (
    etapa: string,
    progresso: number,
    status = "PROCESSING"
  ) => {
    await db.processingJob.updateMany({
      where: { editalId },
      data:  { etapa, progresso, status: status as "QUEUED" | "PROCESSING" | "DONE" | "FAILED" },
    });
  };

  try {
    // ── ETAPA 1: PARSING DO PDF ─────────────────────────
    await db.edital.update({
      where: { id: editalId },
      data:  { status: "PARSING" },
    });
    await updateJob("Extraindo texto do PDF", 15);

    const pdfBuffer = Buffer.from(fileBase64, "base64");
    const pdfData   = await pdfParse(pdfBuffer);
    const textoRaw  = pdfData.text;

    await db.edital.update({
      where: { id: editalId },
      data:  { textoRaw },
    });

    // ── ETAPA 2: CLAUDE — EXTRAÇÃO ESTRUTURADA ──────────
    await updateJob("IA analisando o edital", 35);

    const metadados = await extrairMetadadosComClaude(textoRaw);

    await db.edital.update({
      where: { id: editalId },
      data: {
        banca:         metadados.banca,
        orgao:         metadados.orgao,
        cargo:         metadados.cargo,
        editalNumero:  metadados.editalNumero,
        totalQuestoes: metadados.totalQuestoes,
        dataProva:     metadados.dataProva ? new Date(metadados.dataProva) : null,
        salario:       metadados.salario,
        vagas:         metadados.vagas,
        metadadosJson: metadados as object,
        status:        "MAPPING",
      },
    });

    // ── ETAPA 3: CRUZAR COM BANCO OFFLINE ───────────────
    await updateJob("Cruzando com banco de conteúdo", 60);

    for (const disc of metadados.disciplinas) {
      // Buscar disciplina correspondente no banco (fuzzy)
      const disciplinaMatch = await buscarDisciplina(disc.nome);

      await db.editalDisciplina.create({
        data: {
          editalId,
          nome:        disc.nome,
          peso:        disc.peso,
          numQuestoes: disc.numQuestoes,
          topicosJson: disc.topicos,
          disciplinaId: disciplinaMatch?.id ?? null,
        },
      });
    }

    // ── ETAPA 4: GERAR PLANO ────────────────────────────
    await db.edital.update({
      where: { id: editalId },
      data:  { status: "PLANNING" },
    });
    await updateJob("Gerando plano de estudos", 80);

    await gerarPlanoEstudo({
      userId,
      editalId,
      disciplinas:  metadados.disciplinas,
      dataProva:    metadados.dataProva,
    });

    // ── CONCLUÍDO ────────────────────────────────────────
    await db.edital.update({
      where: { id: editalId },
      data:  { status: "ACTIVE" },
    });
    await updateJob("Concluído", 100, "DONE");

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";

    await db.edital.update({
      where: { id: editalId },
      data:  { status: "ERROR", errorMessage: msg },
    });

    await db.processingJob.updateMany({
      where: { editalId },
      data: {
        status:       "FAILED",
        erroMensagem: msg,
        erroStack:    error instanceof Error ? error.stack : null,
        concluidoEm:  new Date(),
      },
    });

    throw error;
  }
}

// ────────────────────────────────────────────────────────────
// EXTRAÇÃO COM CLAUDE
// ────────────────────────────────────────────────────────────

async function extrairMetadadosComClaude(
  textoRaw: string
): Promise<EditalMetadados> {
  // Truncar texto para caber no contexto (primeiros 80k chars são suficientes)
  const texto = textoRaw.slice(0, 80000);

  const message = await claude.messages.create({
    model:      "claude-opus-4-5",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Você é um especialista em análise de editais de concursos públicos brasileiros.

Analise o edital abaixo e extraia as informações estruturadas em JSON válido.

EDITAL:
${texto}

Retorne APENAS o JSON, sem texto adicional, seguindo EXATAMENTE este schema:
{
  "banca": "nome da banca examinadora",
  "orgao": "órgão público",
  "cargo": "cargo específico",
  "editalNumero": "número do edital",
  "dataPublicacao": "YYYY-MM-DD ou null",
  "dataProva": "YYYY-MM-DD ou null",
  "salario": número ou null,
  "vagas": número inteiro ou null,
  "totalQuestoes": número inteiro,
  "disciplinas": [
    {
      "nome": "nome exato da disciplina",
      "peso": porcentagem como decimal 0-1,
      "numQuestoes": número de questões,
      "topicos": ["topico1", "topico2", ...]
    }
  ]
}

Regras:
- Se não encontrar algum campo, use null
- Discipline names em português
- Tópicos: extraia os itens do programa/conteúdo
- Peso: calcule como numQuestoes/totalQuestoes`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Resposta inesperada do Claude");
  }

  // Extrair JSON da resposta (pode vir com markdown)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude não retornou JSON válido");
  }

  return JSON.parse(jsonMatch[0]) as EditalMetadados;
}

// ────────────────────────────────────────────────────────────
// BUSCA DE DISCIPLINA NO BANCO OFFLINE (fuzzy)
// ────────────────────────────────────────────────────────────

async function buscarDisciplina(
  nomeDisciplina: string
): Promise<{ id: string } | null> {
  // Normalizar para busca
  const normalizado = nomeDisciplina
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Busca exata primeiro
  const exata = await db.disciplina.findFirst({
    where: {
      slug: {
        contains: normalizado.replace(/\s+/g, "-").slice(0, 20),
      },
    },
    select: { id: true },
  });

  if (exata) return exata;

  // Busca por palavra-chave principal (primeira palavra significativa)
  const palavras = normalizado
    .split(/\s+/)
    .filter((p) => p.length > 4);

  for (const palavra of palavras) {
    const match = await db.disciplina.findFirst({
      where: { slug: { contains: palavra } },
      select: { id: true },
    });
    if (match) return match;
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// GERAR PLANO DE ESTUDOS
// ────────────────────────────────────────────────────────────

async function gerarPlanoEstudo(params: {
  userId:      string;
  editalId:    string;
  disciplinas: EditalMetadados["disciplinas"];
  dataProva?:  string;
}) {
  const { userId, editalId, disciplinas, dataProva } = params;

  const dataInicio = new Date();
  const dataFinal  = dataProva ? new Date(dataProva) : new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000
  );

  // Distribuição por peso do edital
  const distribuicao: Record<string, {
    percentual:  number;
    horasTotal:  number;
    ciclos:      number;
  }> = {};

  const totalDias = Math.max(
    1,
    Math.floor((dataFinal.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24))
  );

  const horasDia = 4; // padrão
  const horasTotal = totalDias * horasDia;

  for (const d of disciplinas) {
    distribuicao[d.nome] = {
      percentual: d.peso,
      horasTotal: Math.round(horasTotal * d.peso),
      ciclos:     Math.max(1, Math.floor(totalDias / 30)),
    };
  }

  await db.planoEstudo.create({
    data: {
      userId,
      editalId,
      dataInicio,
      dataFinal,
      horasDia,
      diasSemana:       [1, 2, 3, 4, 5], // seg-sex
      distribuicaoJson: distribuicao,
      probabilidadeAprovacao: 0.5, // baseline
    },
  });
}
