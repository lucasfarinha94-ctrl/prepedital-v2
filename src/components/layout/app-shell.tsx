// ============================================================
// APP SHELL — Layout base para rotas autenticadas
// Sidebar + Header + Main content
// ============================================================

import { Sidebar } from "./sidebar";
import { Header }  from "./header";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0F172A]">
      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <Sidebar />

      {/* ── MAIN AREA ────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />

        {/* Área de conteúdo com scroll */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
