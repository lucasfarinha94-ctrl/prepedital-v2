// ============================================================
// CLEANUP — Re-processa registros com conteúdo sujo no banco
//
// Detecta registros com sumário, grancursos, rodapés etc.
// e re-envia para o Claude com prompt melhorado.
//
// Executar: tsx scripts/cleanup-content.ts
// ============================================================

import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PADROES_SUJOS = [
  /grancursosonline/i,
  /gran cursos/i,
  /www\.gran/i,
  /o conteúdo deste livro é licenciado/i,
  /o conteudo deste livro e licenciado/i,
  /vedada.*reprodução/i,
  /\.\.\.\.\.\./,                // sumário: ......
  /\.{4,}\s*\d+/,               // sumário: ....14
  /^\d{1,3}\s+de\s+\d{1,3}/m,  // rodapé: "3 de 164"
  /lattes\.cnpq/i,
  /DiRei|TRiBu|CONSTi/,         // palavras com fonte errada
];

function estasujo(texto: string): boolean {
  return PADROES_SUJOS.some((p) => p.test(texto));
}

async function limpar(texto: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8096,
    messages: [{
      role: "user",
      content: `Você é um organizador de material didático para concursos públicos brasileiros.

Analise o texto abaixo extraído de um PDF e retorne APENAS o conteúdo educacional limpo e estruturado.

═══ REMOVA COMPLETAMENTE ═══
- Sumários e índices (linhas com "....", "......1", "......25" etc)
- Qualquer menção a "Gran Cursos", "grancursosonline.com.br", "www.grancursos"
- Avisos de copyright, licença, reprodução proibida
- "O conteúdo deste livro é licenciado para [NOME]"
- Rodapés: "X de Y", "2 de 77", "www.", números de página isolados
- Biografia do professor (doutor, mestre, lattes.cnpq, etc)
- Apresentação/introdução do curso
- Cabeçalhos repetidos de capítulo

═══ CORRIJA ═══
- Palavras com letras separadas: "DiReiTO" → "Direito", "Direi To Tribu Tário" → "Direito Tributário"
- Palavras coladas: "vocêJáouviu" → "você já ouviu", "ocrédito" → "o crédito"
- Letras maiúsculas intercaladas: "PRiNCÍPiOS" → "Princípios"

═══ MANTENHA ═══
- TODO conteúdo jurídico, técnico e educacional
- Artigos de lei, definições, conceitos, exemplos práticos
- Estrutura de tópicos, listas e subtópicos

NÃO resuma. NÃO adicione texto. NÃO explique. Retorne APENAS o texto limpo.

TEXTO:
${texto.slice(0, 15000)}`,
    }],
  });

  const content = msg.content[0];
  if (content.type === "text") return content.text.trim();
  return texto;
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log(" CLEANUP — Re-processando conteúdos sujos");
  console.log("═══════════════════════════════════════");

  // Busca todos os registros em lotes de 50
  let offset = 0;
  const batchSize = 50;
  let totalProcessados = 0;
  let totalLimpos = 0;
  let totalErros = 0;

  while (true) {
    const registros = await db.conteudo.findMany({
      select: { id: true, titulo: true, corpo: true },
      skip: offset,
      take: batchSize,
    });

    if (registros.length === 0) break;

    for (const reg of registros) {
      if (!reg.corpo) {
        offset++;
        continue;
      }

      totalProcessados++;

      if (!estasujo(reg.corpo)) {
        process.stdout.write("·"); // já está limpo
        continue;
      }

      try {
        const corpLimpo = await limpar(reg.corpo);
        await db.conteudo.update({
          where: { id: reg.id },
          data: { corpo: corpLimpo },
        });
        totalLimpos++;
        process.stdout.write("✓");
      } catch (err: unknown) {
        totalErros++;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("credit") || msg.includes("429")) {
          console.log("\n⚠️  Créditos insuficientes — parou no registro", reg.id);
          console.log(`Processados: ${totalProcessados} | Limpos: ${totalLimpos} | Erros: ${totalErros}`);
          process.exit(1);
        }
        process.stdout.write("✗");
      }
    }

    offset += batchSize;
  }

  console.log("\n═══════════════════════════════════════");
  console.log(` CONCLUÍDO!`);
  console.log(` Total verificados : ${totalProcessados}`);
  console.log(` Re-limpos com IA  : ${totalLimpos}`);
  console.log(` Erros             : ${totalErros}`);
  console.log("═══════════════════════════════════════");

  await db.$disconnect();
}

main().catch(console.error);
