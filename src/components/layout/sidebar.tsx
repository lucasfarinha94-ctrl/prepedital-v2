// ============================================================
// SIDEBAR — Layout V2
// Minimalista, 240px expandida / 64px colapsada
// Feature gating visual nos itens bloqueados
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  ClipboardList,
  RotateCcw,
  BarChart2,
  Upload,
  Lock,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditalStore, selectHasEdital } from "@/stores/edital-store";
import { usePlanStore } from "@/stores/plan-store";
import { hasFeature } from "@/lib/feature-gating";
import { useState } from "react";

// ────────────────────────────────────────────────────────────
// DEFINIÇÃO DE ITENS DE NAVEGAÇÃO
// ────────────────────────────────────────────────────────────

interface NavItem {
  href:    string;
  label:   string;
  icon:    React.ElementType;
  phase:   1 | 2;          // 1 = pré-edital, 2 = pós-edital
  feature?: string;         // feature gate (se existir)
}

const NAV_ITEMS: NavItem[] = [
  // Fase 1 — sempre disponíveis
  { href: "/overview", label: "Visão Geral",  icon: Zap,           phase: 1 },
  { href: "/upload",   label: "Upload Edital", icon: Upload,        phase: 1 },

  // Fase 2 — requerem edital ativo
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard, phase: 2 },
  { href: "/conteudo",    label: "Conteúdo",    icon: BookOpen,        phase: 2 },
  { href: "/questoes",    label: "Questões",    icon: HelpCircle,      phase: 2 },
  { href: "/simulados",   label: "Simulados",   icon: ClipboardList,   phase: 2, feature: "hasSimulados" },
  { href: "/revisao",     label: "Revisão IA",  icon: RotateCcw,       phase: 2, feature: "hasRevisaoIA" },
  { href: "/estatisticas",label: "Estatísticas",icon: BarChart2,       phase: 2 },
];

// ────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname    = usePathname();
  const hasEdital = useEditalStore(selectHasEdital);
  const { plan }    = usePlanStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative flex flex-col h-screen bg-[#111827] border-r border-[#1F2937] flex-shrink-0"
    >
      {/* ── LOGO / BRAND ─────────────────────────────────── */}
      <div className="flex items-center h-14 px-4 border-b border-[#1F2937]">
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2.5"
            >
              <div className="h-7 w-7 rounded-md bg-[#5B8CFF] flex items-center justify-center flex-shrink-0">
                <Zap size={14} className="text-white" />
              </div>
              <span className="text-[13px] font-semibold text-[#F8FAFC] tracking-tight">
                Prep<span className="text-[#5B8CFF]">Edital</span>
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-7 w-7 rounded-md bg-[#5B8CFF] flex items-center justify-center"
            >
              <Zap size={14} className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── NAVEGAÇÃO ────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {/* Itens de fase 1 */}
        <div className="mb-4">
          {!collapsed && (
            <p className="px-2 mb-1.5 text-[11px] font-medium text-[#64748B] uppercase tracking-wider">
              Início
            </p>
          )}
          {NAV_ITEMS.filter((i) => i.phase === 1).map((item) => (
            <NavItemComponent
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              locked={false}
            />
          ))}
        </div>

        {/* Itens de fase 2 — bloqueados sem edital */}
        <div>
          {!collapsed && (
            <p className="px-2 mb-1.5 text-[11px] font-medium text-[#64748B] uppercase tracking-wider">
              Estudo
            </p>
          )}
          {NAV_ITEMS.filter((i) => i.phase === 2).map((item) => {
            // Bloqueado se não tem edital
            if (!hasEdital) {
              return (
                <NavItemComponent
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  locked
                  lockReason="edital"
                />
              );
            }

            // Bloqueado por feature gate
            const featureLocked =
              item.feature &&
              !hasFeature(plan as Parameters<typeof hasFeature>[0], item.feature as Parameters<typeof hasFeature>[1]);

            return (
              <NavItemComponent
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                locked={!!featureLocked}
                lockReason="plan"
              />
            );
          })}
        </div>
      </nav>

      {/* ── BOTÃO COLAPSAR ───────────────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute -right-3 top-[52px]",
          "h-6 w-6 rounded-full",
          "bg-[#1E293B] border border-[#1F2937]",
          "flex items-center justify-center",
          "text-[#64748B] hover:text-[#F8FAFC]",
          "transition-colors duration-150",
          "z-10"
        )}
        aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      >
        {collapsed ? (
          <ChevronRight size={12} />
        ) : (
          <ChevronLeft size={12} />
        )}
      </button>
    </motion.aside>
  );
}

// ────────────────────────────────────────────────────────────
// ITEM DE NAVEGAÇÃO
// ────────────────────────────────────────────────────────────

interface NavItemComponentProps {
  item:        NavItem;
  pathname:    string;
  collapsed:   boolean;
  locked:      boolean;
  lockReason?: "edital" | "plan";
}

function NavItemComponent({
  item,
  pathname,
  collapsed,
  locked,
  lockReason,
}: NavItemComponentProps) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  const inner = (
    <span
      className={cn(
        "flex items-center gap-3",
        "h-9 rounded-md px-3",
        "text-[13px] font-medium",
        "transition-all duration-150",
        // Estado ativo
        isActive
          ? "bg-[#1E293B] text-[#F8FAFC] border-l-2 border-[#5B8CFF] pl-[10px]"
          : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]",
        // Estado bloqueado
        locked && "opacity-35 cursor-not-allowed"
      )}
    >
      <Icon size={16} className="flex-shrink-0" />
      {!collapsed && (
        <AnimatePresence>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 truncate"
          >
            {item.label}
          </motion.span>
        </AnimatePresence>
      )}
      {/* Ícone de bloqueio */}
      {locked && !collapsed && (
        <Lock size={11} className="flex-shrink-0 ml-auto text-[#64748B]" />
      )}
    </span>
  );

  if (locked) {
    return <div className="relative">{inner}</div>;
  }

  return (
    <Link href={item.href} className="block">
      {inner}
    </Link>
  );
}
