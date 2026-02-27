// ============================================================
// HEADER — Layout V2
// Contextual: mostra edital ativo + ações rápidas
// ============================================================

"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditalStore } from "@/stores/edital-store";
import { usePlanStore } from "@/stores/plan-store";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

// Mapeamento de pathname para título de página
const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/overview":    { title: "Início",        subtitle: "Configure sua preparação" },
  "/upload":      { title: "Upload de Edital", subtitle: "Ative o ecossistema de preparação" },
  "/dashboard":   { title: "Dashboard",     subtitle: "Visão estratégica da preparação" },
  "/conteudo":    { title: "Conteúdo",      subtitle: "Material mapeado pelo edital" },
  "/questoes":    { title: "Questões",      subtitle: "Banco de questões por banca" },
  "/simulados":   { title: "Simulados",     subtitle: "Provas completas e parciais" },
  "/revisao":     { title: "Revisão IA",    subtitle: "Repetição espaçada inteligente" },
  "/estatisticas":{ title: "Estatísticas",  subtitle: "Performance e pontos fracos" },
};

// Badge de plano
const PLAN_BADGES: Record<string, { label: string; color: string }> = {
  FREE:    { label: "Free",    color: "#64748B" },
  PRO:     { label: "Pro",     color: "#5B8CFF" },
  ELITE:   { label: "Elite",   color: "#22C55E" },
  FOUNDER: { label: "Founder", color: "#F59E0B" },
};

export function Header() {
  const pathname          = usePathname();
  const { data: session } = useSession();
  const { activeEdital }  = useEditalStore();
  const { plan }          = usePlanStore();

  // Pega o caminho base (ex: /dashboard/config → /dashboard)
  const basePath = "/" + (pathname.split("/")[1] ?? "");
  const page = PAGE_TITLES[basePath] ?? { title: "Sistema de Preparação" };

  const planBadge = PLAN_BADGES[plan] ?? PLAN_BADGES["FREE"];

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[#1F2937] bg-[#0F172A] flex-shrink-0">
      {/* ── LADO ESQUERDO — Título da página ────────────── */}
      <div className="flex flex-col justify-center">
        <h1 className="text-[15px] font-semibold text-[#F8FAFC] leading-tight">
          {page.title}
        </h1>
        {/* Edital ativo aparece como subtítulo nas rotas de fase 2 */}
        {activeEdital && page.subtitle ? (
          <p className="text-[11px] text-[#64748B] mt-0.5 font-medium">
            <span className="text-[#5B8CFF]">{activeEdital.banca}</span>
            {" · "}
            {activeEdital.cargo}
            {" · "}
            {activeEdital.orgao}
          </p>
        ) : page.subtitle ? (
          <p className="text-[11px] text-[#64748B] mt-0.5">{page.subtitle}</p>
        ) : null}
      </div>

      {/* ── LADO DIREITO — Ações + Perfil ───────────────── */}
      <div className="flex items-center gap-3">
        {/* Badge do plano */}
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium",
            "border"
          )}
          style={{
            color:            planBadge.color,
            borderColor:      planBadge.color + "30",
            backgroundColor:  planBadge.color + "10",
          }}
        >
          {planBadge.label}
        </span>

        {/* Notificações */}
        <button
          className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center",
            "text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#1E293B]",
            "transition-colors duration-150",
            "relative"
          )}
          aria-label="Notificações"
        >
          <Bell size={15} />
        </button>

        {/* Configurações */}
        <button
          className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center",
            "text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#1E293B]",
            "transition-colors duration-150"
          )}
          aria-label="Configurações"
        >
          <Settings size={15} />
        </button>

        {/* Divisor */}
        <div className="h-5 w-px bg-[#1F2937]" />

        {/* Avatar do usuário */}
        <button
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 rounded-md",
            "hover:bg-[#1E293B] transition-colors duration-150"
          )}
        >
          {/* Avatar */}
          <div className="h-7 w-7 rounded-full bg-[#1E293B] border border-[#1F2937] flex items-center justify-center overflow-hidden">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[11px] font-medium text-[#94A3B8]">
                {session?.user?.name?.charAt(0)?.toUpperCase() ?? "U"}
              </span>
            )}
          </div>

          {/* Nome */}
          <span className="text-[13px] font-medium text-[#F8FAFC] max-w-[120px] truncate hidden sm:block">
            {session?.user?.name ?? "Usuário"}
          </span>

          <ChevronDown size={13} className="text-[#64748B]" />
        </button>
      </div>
    </header>
  );
}
