"use client";

import { useEffect, useState } from "react";

interface Status {
  total: number;
  meta: string;
  percentual: string;
  breakdown: { disciplina: string; count: number }[];
  timestamp: string;
}

export default function IndexerStatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/indexer-status");
      const data = await res.json();
      setStatus(data);
      setLastUpdate(new Date().toLocaleTimeString("pt-BR"));
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // atualiza a cada 10s
    return () => clearInterval(interval);
  }, []);

  if (!status) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <p className="text-[#94A3B8]">Carregando...</p>
      </div>
    );
  }

  const pct = parseFloat(status.percentual);

  return (
    <div className="min-h-screen bg-[#0F172A] p-8 text-white">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">📊 Indexador — Status em Tempo Real</h1>
          <p className="text-[#94A3B8] text-sm mt-1">Atualiza automaticamente a cada 10 segundos · Última: {lastUpdate}</p>
        </div>

        {/* Progresso geral */}
        <div className="bg-[#1E293B] rounded-xl p-6 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[#94A3B8] text-sm">PDFs indexados</p>
              <p className="text-4xl font-bold text-white">{status.total.toLocaleString("pt-BR")}</p>
            </div>
            <div className="text-right">
              <p className="text-[#94A3B8] text-sm">Meta</p>
              <p className="text-2xl font-semibold text-[#64748B]">{parseInt(status.meta).toLocaleString("pt-BR")}</p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="w-full bg-[#0F172A] rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(pct, 100)}%`,
                background: pct < 30 ? "#3B82F6" : pct < 70 ? "#F59E0B" : "#22C55E",
              }}
            />
          </div>
          <p className="text-right text-sm font-semibold" style={{
            color: pct < 30 ? "#3B82F6" : pct < 70 ? "#F59E0B" : "#22C55E"
          }}>
            {status.percentual}% concluído
          </p>
        </div>

        {/* Por disciplina */}
        {status.breakdown.length > 0 && (
          <div className="bg-[#1E293B] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-4">Por Disciplina</h2>
            <div className="space-y-2">
              {status.breakdown.map((item) => (
                <div key={item.disciplina} className="flex items-center justify-between">
                  <span className="text-sm text-white truncate max-w-[75%]">{item.disciplina}</span>
                  <span className="text-sm font-mono text-[#22C55E] ml-2">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botão refresh manual */}
        <button
          onClick={fetchStatus}
          className="w-full py-3 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] transition-colors text-sm font-semibold"
        >
          🔄 Atualizar agora
        </button>
      </div>
    </div>
  );
}
