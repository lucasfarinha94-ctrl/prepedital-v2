// ============================================================
// API ROUTE — /api/edital/status (polling de progresso)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db }   from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const editalId = req.nextUrl.searchParams.get("id");
  if (!editalId) {
    return NextResponse.json({ error: "Missing edital ID" }, { status: 400 });
  }

  const edital = await db.edital.findFirst({
    where: { id: editalId, userId: session.user.id },
    include: {
      disciplinas: { select: { id: true, nome: true, peso: true, numQuestoes: true } },
    },
  });

  if (!edital) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const job = await db.processingJob.findFirst({
    where:   { editalId },
    orderBy: { createdAt: "desc" },
    select:  { progresso: true, etapa: true, status: true },
  });

  return NextResponse.json({
    status:       edital.status,
    errorMessage: edital.errorMessage,
    progresso:    job?.progresso ?? 0,
    etapa:        job?.etapa ?? "",
    edital: edital.status === "ACTIVE" ? {
      id: edital.id, banca: edital.banca, orgao: edital.orgao,
      cargo: edital.cargo, dataProva: edital.dataProva?.toISOString(),
      totalQuestoes: edital.totalQuestoes, disciplinas: edital.disciplinas,
    } : null,
  });
}
