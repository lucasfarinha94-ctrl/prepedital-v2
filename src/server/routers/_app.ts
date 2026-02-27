// ============================================================
// APP ROUTER — Raiz do tRPC (agrega todos os routers)
// ============================================================

import { router } from "@/server/trpc";
import { editalRouter }  from "./edital";
import { statsRouter }   from "./stats";
import { planoRouter }   from "./plano";
import { questaoRouter } from "./questao";
import { conteudoRouter } from "./conteudo";

export const appRouter = router({
  edital:   editalRouter,
  stats:    statsRouter,
  plano:    planoRouter,
  questao:  questaoRouter,
  conteudo: conteudoRouter,
});

export type AppRouter = typeof appRouter;
