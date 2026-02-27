// ============================================================
// TRPC SETUP — next-auth v5 + tRPC v11
// ============================================================

import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const DEV_SESSION = {
  user: { id: "dev-user-id", name: "Dev User", email: "dev@local.dev", image: null },
  expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
};

export async function createTRPCContext(opts: { req: NextRequest }) {
  const isDev = process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "true";
  const session = isDev ? DEV_SESSION : await auth();
  return { db, session, req: opts.req };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router          = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Autenticação necessária." });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

const enforceEdital = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });

  const userId = ctx.session.user.id as string;
  const edital = await ctx.db.edital.findFirst({
    where:  { userId, status: "ACTIVE" },
    select: { id: true },
  });

  if (!edital) {
    throw new TRPCError({
      code:    "PRECONDITION_FAILED",
      message: "Nenhum edital ativo. Faça o upload de um edital para continuar.",
    });
  }

  return next({ ctx: { ...ctx, activeEditalId: edital.id } });
});

export const protectedProcedure = t.procedure.use(enforceAuth);
export const editalProcedure    = t.procedure.use(enforceAuth).use(enforceEdital);
