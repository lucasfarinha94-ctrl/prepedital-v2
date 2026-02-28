import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const [total, porDisciplina] = await Promise.all([
    db.conteudo.count(),
    db.conteudo.groupBy({
      by: ["disciplinaId"],
      _count: { id: true },
    }),
  ]);

  const disciplinas = await db.disciplina.findMany({
    select: { id: true, nome: true, slug: true },
  });

  const disciplinaMap = Object.fromEntries(disciplinas.map((d) => [d.id, d.nome]));

  const breakdown = porDisciplina
    .map((g) => ({
      disciplina: disciplinaMap[g.disciplinaId] ?? "Desconhecida",
      count: g._count.id,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total,
    meta: "2620",
    percentual: ((total / 2620) * 100).toFixed(1),
    breakdown,
    timestamp: new Date().toISOString(),
  });
}
