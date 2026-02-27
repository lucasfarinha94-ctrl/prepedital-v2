// ============================================================
// API ROUTE — tRPC handler (Next.js App Router)
// ============================================================

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest }    from "next/server";
import { appRouter }           from "@/server/routers/_app";
import { createTRPCContext }   from "@/server/trpc";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint:   "/api/trpc",
    req,
    router:     appRouter,
    createContext: () => createTRPCContext({ req }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`[tRPC] Erro em /${path}:`, error);
          }
        : undefined,
  });

export { handler as GET, handler as POST };
