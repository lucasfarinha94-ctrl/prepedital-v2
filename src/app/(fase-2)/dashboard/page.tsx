// ============================================================
// DASHBOARD — Fase 2 (edital ativo)
// Métricas estratégicas + evolução + foco do dia
// ============================================================

"use client";

import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Target, BookOpen, Clock, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppShell } from "@/components/layout/app-shell";
import { cn, pct, formatDuration, acertoColor } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

// ────────────────────────────────────────────────────────────
// TOOLTIP CUSTOMIZADO DO GRÁFICO
// ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1E293B] border border-[#1F2937] rounded-md px-3 py-2 text-[12px]">
      <p className="text-[#64748B] mb-0.5">{label}</p>
      <p className="text-[#F8FAFC] font-semibold">{payload[0].value}%</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ────────────────────────────────────────────────────────────

function HeroMetric({
  value,
  trend,
  label,
}: {
  value: number;
  trend: number;
  label: string;
}) {
  const isUp   = trend > 0;
  const isFlat = trend === 0;
  const TrendIcon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const trendColor = isFlat
    ? "text-[#64748B]"
    : isUp
    ? "text-[#22C55E]"
    : "text-[#EF4444]";

  return (
    <Card variant="hero" className="col-span-4 sm:col-span-2 lg:col-span-1">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="label-upper">Prob. aprovação</span>
          <Target size={15} className="text-[#64748B]" />
        </div>

        {/* Número principal */}
        <div className="flex items-end gap-2">
          <span className="metric">{value}%</span>
        </div>

        {/* Tendência */}
        <div className="flex items-center gap-1.5">
          <div className={cn("flex items-center gap-1", trendColor)}>
            <TrendIcon size={13} />
            <span className="text-[12px] font-medium">
              {isFlat ? "Estável" : `${isUp ? "+" : ""}${trend.toFixed(1)}%`}
            </span>
          </div>
          <span className="text-[11px] text-[#64748B]">vs semana anterior</span>
        </div>
      </div>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  subtext,
  icon: Icon,
}: {
  label:   string;
  value:   string;
  subtext: string;
  icon:    React.ElementType;
}) {
  return (
    <Card variant="base" padding="md">
      <div className="flex items-start justify-between mb-3">
        <span className="label-upper">{label}</span>
        <Icon size={14} className="text-[#64748B]" />
      </div>
      <p className="text-2xl font-semibold text-[#F8FAFC] tracking-tight mb-1">
        {value}
      </p>
      <p className="text-[11px] text-[#64748B]">{subtext}</p>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // Dados do dashboard via tRPC
  const { data: stats } = trpc.stats.getOverview.useQuery();
  const { data: foco }  = trpc.plano.getDiaAtual.useQuery();

  // Fallback com dados mock enquanto carrega
  const aprovacao = stats?.aprovacao ?? 73;
  const tendencia = stats?.tendencia ?? 5.2;

  const evolucao = stats?.evolucao ?? [
    { semana: "S1", acerto: 45 },
    { semana: "S2", acerto: 52 },
    { semana: "S3", acerto: 48 },
    { semana: "S4", acerto: 61 },
    { semana: "S5", acerto: 58 },
    { semana: "S6", acerto: 67 },
    { semana: "S7", acerto: 71 },
    { semana: "S8", acerto: 73 },
  ];

  const disciplinas = stats?.disciplinas ?? [
    { nome: "Direito Administrativo", acerto: 0.78, questoes: 240 },
    { nome: "Contabilidade Geral",    acerto: 0.61, questoes: 180 },
    { nome: "Direito Constitucional", acerto: 0.55, questoes: 160 },
    { nome: "Raciocínio Lógico",      acerto: 0.82, questoes: 120 },
    { nome: "Direito Tributário",     acerto: 0.48, questoes: 90  },
  ];

  return (
    <AppShell>
      {/* ── GRID PRINCIPAL ─────────────────────────────────── */}
      <div className="space-y-4">

        {/* ROW 1: Hero + KPIs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-4 gap-4"
        >
          {/* Hero Metric — ocupa 1 coluna no desktop */}
          <div className="col-span-4 sm:col-span-1">
            <HeroMetric value={aprovacao} trend={tendencia} label="Probabilidade de aprovação" />
          </div>

          {/* KPIs — ocupam 3 colunas */}
          <div className="col-span-4 sm:col-span-3 grid grid-cols-3 gap-4">
            <KpiCard
              label="Questões hoje"
              value={String(stats?.questoesHoje ?? 48)}
              subtext="Meta: 60 questões"
              icon={BookOpen}
            />
            <KpiCard
              label="Horas estudadas"
              value={formatDuration(stats?.horasEstudadas ?? 142)}
              subtext="Total acumulado"
              icon={Clock}
            />
            <KpiCard
              label="Taxa de acerto"
              value={pct((stats?.taxaGlobal ?? 0.73), 0)}
              subtext="Últimos 7 dias"
              icon={Zap}
            />
          </div>
        </motion.div>

        {/* ROW 2: Gráfico de evolução + Disciplinas */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="grid grid-cols-3 gap-4"
        >
          {/* Gráfico de evolução — 2 colunas */}
          <Card variant="base" padding="lg" className="col-span-3 lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Evolução por semana</CardTitle>
                <span className="text-[11px] text-[#64748B]">Taxa de acerto (%)</span>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={evolucao}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1F2937"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="semana"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 11 }}
                  />
                  <YAxis
                    domain={[30, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    width={36}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="acerto"
                    stroke="#5B8CFF"
                    strokeWidth={2}
                    dot={{ fill: "#5B8CFF", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#5B8CFF", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Disciplinas — 1 coluna */}
          <Card variant="base" padding="lg" className="col-span-3 lg:col-span-1">
            <CardHeader>
              <CardTitle>Desempenho por disciplina</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {disciplinas.slice(0, 5).map((d, i) => (
                <motion.div
                  key={d.nome}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  className="stagger-item"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-[#F8FAFC] font-medium truncate max-w-[140px]">
                      {d.nome}
                    </span>
                    <span
                      className="text-[12px] font-semibold flex-shrink-0"
                      style={{ color: acertoColor(d.acerto) }}
                    >
                      {pct(d.acerto, 0)}
                    </span>
                  </div>
                  {/* Barra de progresso */}
                  <div className="h-[3px] bg-[#1E293B] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: acertoColor(d.acerto) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${d.acerto * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.05, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    {d.questoes} questões respondidas
                  </p>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* ROW 3: Foco do dia */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.16 }}
        >
          <Card variant="base" padding="lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Foco do dia</CardTitle>
                <span className="text-[11px] text-[#94A3B8]">
                  {foco?.data ?? new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(foco?.itens ?? [
                  { tipo: "estudo",   disciplina: "Direito Tributário",     topico: "ICMS",          duracaoMin: 90 },
                  { tipo: "questoes", disciplina: "Contabilidade Geral",    topico: "Depreciação",   duracaoMin: 45 },
                  { tipo: "revisao",  disciplina: "Direito Administrativo", topico: "Atos Administrativos", duracaoMin: 30 },
                ]).map((item: { tipo: string; disciplina: string; topico: string; duracaoMin: number }, i: number) => {
                  const colors: Record<string, string> = {
                    estudo:   "#5B8CFF",
                    questoes: "#22C55E",
                    revisao:  "#F59E0B",
                  };
                  const color = colors[item.tipo] ?? "#5B8CFF";

                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-4 rounded-md bg-[#111827] border border-[#1F2937] hover:border-[rgba(91,140,255,0.2)] transition-colors"
                    >
                      {/* Indicador de tipo */}
                      <div
                        className="h-1.5 w-1.5 rounded-full flex-shrink-0 mt-1.5"
                        style={{ backgroundColor: color }}
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wider mb-0.5" style={{ color }}>
                          {item.tipo}
                        </p>
                        <p className="text-[13px] font-medium text-[#F8FAFC] truncate">
                          {item.disciplina}
                        </p>
                        <p className="text-[11px] text-[#94A3B8] truncate">{item.topico}</p>
                        <p className="text-[11px] text-[#64748B] mt-1">
                          {formatDuration(item.duracaoMin)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppShell>
  );
}
