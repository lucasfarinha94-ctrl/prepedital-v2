// ============================================================
// PROVIDERS — next-auth v5 + tRPC v11 + Zustand
// ============================================================

"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import superjson from "superjson";
import { useState, useEffect } from "react";
import { usePlanStore } from "@/stores/plan-store";
import type { PlanTier } from "@prisma/client";

function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
      },
    })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url:         "/api/trpc",
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

function PlanSynchronizer({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { setPlan }       = usePlanStore();

  useEffect(() => {
    if (session?.user) {
      const plan = (session.user as { plan?: string }).plan as PlanTier ?? "FREE";
      setPlan(plan);
    }
  }, [session, setPlan]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCProvider>
        <PlanSynchronizer>
          {children}
        </PlanSynchronizer>
      </TRPCProvider>
    </SessionProvider>
  );
}
