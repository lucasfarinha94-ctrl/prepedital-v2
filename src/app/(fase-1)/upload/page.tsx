// ============================================================
// UPLOAD PAGE — Fase 1 (premium)
// Drop zone + upload para Supabase + polling de status
// ============================================================

"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import { useEditalStore } from "@/stores/edital-store";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

// ────────────────────────────────────────────────────────────
// ETAPAS DE PROCESSAMENTO
// ────────────────────────────────────────────────────────────

const ETAPAS = [
  { id: "uploading", label: "Enviando arquivo",          pct: 15 },
  { id: "queued",    label: "Na fila de processamento",  pct: 25 },
  { id: "parsing",   label: "IA extraindo metadados",    pct: 55 },
  { id: "mapping",   label: "Cruzando com banco offline",pct: 75 },
  { id: "planning",  label: "Gerando plano de estudos",  pct: 90 },
  { id: "done",      label: "Pronto",                    pct: 100 },
];

type UploadState =
  | "idle"
  | "dragging"
  | "selected"
  | "uploading"
  | "processing"
  | "done"
  | "error";

// ────────────────────────────────────────────────────────────
// COMPONENTE
// ────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router    = useRouter();
  const fileRef   = useRef<HTMLInputElement>(null);

  const { setProcessing, setJobId, setActiveEdital, addEdital } = useEditalStore();

  const [state,     setState]     = useState<UploadState>("idle");
  const [file,      setFile]      = useState<File | null>(null);
  const [progress,  setProgress]  = useState(0);
  const [etapa,     setEtapa]     = useState("");
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);

  // tRPC mutation para iniciar processamento
  const uploadMutation = trpc.edital.upload.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId);
      setState("processing");
      pollStatus(data.editalId);
    },
    onError: (err) => {
      setState("error");
      setErrorMsg(err.message);
    },
  });

  // Polling de status do processamento
  const pollStatus = useCallback(
    async (editalId: string) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/edital/status?id=${editalId}`);
          const data = await res.json();

          const etapaInfo = ETAPAS.find((e) => e.id === data.status);
          if (etapaInfo) {
            setProgress(etapaInfo.pct);
            setEtapa(etapaInfo.label);
            setProcessing(data.status, etapaInfo.pct, etapaInfo.label);
          }

          if (data.status === "done" || data.status === "ACTIVE") {
            clearInterval(interval);
            setState("done");
            setProgress(100);

            // Ativar edital no store
            const edital = data.edital;
            setActiveEdital(edital);
            addEdital(edital);

            // Redirecionar para dashboard após 1.5s
            setTimeout(() => router.push("/dashboard"), 1500);
          }

          if (data.status === "error" || data.status === "ERROR") {
            clearInterval(interval);
            setState("error");
            setErrorMsg(data.errorMessage ?? "Erro no processamento. Tente novamente.");
          }
        } catch {
          clearInterval(interval);
          setState("error");
          setErrorMsg("Falha na comunicação com o servidor.");
        }
      }, 2000); // Poll a cada 2s
    },
    [router, setActiveEdital, addEdital, setProcessing]
  );

  // ── DRAG & DROP HANDLERS ──────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
      setState("selected");
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setState("selected");
    }
  }, []);

  // ── INICIAR UPLOAD ────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setState("uploading");
    setProgress(10);
    setEtapa("Enviando arquivo...");

    // Converter para base64 (para tRPC)
    // Em produção: usar presigned URL do Supabase Storage diretamente
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        fileName: file.name,
        fileSize: file.size,
        fileBase64: base64,
      });
    };
    reader.readAsDataURL(file);
  }, [file, uploadMutation]);

  const handleReset = () => {
    setState("idle");
    setFile(null);
    setProgress(0);
    setEtapa("");
    setErrorMsg(null);
  };

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* ── HEADER DA PÁGINA ──────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[#F8FAFC] mb-1.5 tracking-tight">
            Ativar sistema
          </h2>
          <p className="text-[#94A3B8] text-sm">
            Faça o upload do edital em PDF. A IA extrai automaticamente as
            disciplinas, pesos e tópicos — e cria o seu plano de estudos.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* ── ESTADO: IDLE / DRAGGING / SELECTED ─────────── */}
          {(state === "idle" || state === "dragging" || state === "selected") && (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setState("dragging");
                }}
                onDragLeave={() => setState(file ? "selected" : "idle")}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "relative flex flex-col items-center justify-center",
                  "h-52 rounded-lg border-2 border-dashed",
                  "cursor-pointer transition-all duration-200",
                  state === "dragging"
                    ? "border-[#5B8CFF] bg-[rgba(91,140,255,0.06)]"
                    : state === "selected"
                    ? "border-[rgba(91,140,255,0.4)] bg-[#111827]"
                    : "border-[#1F2937] bg-[#111827] hover:border-[rgba(91,140,255,0.3)] hover:bg-[rgba(91,140,255,0.03)]"
                )}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {state === "selected" && file ? (
                  // Arquivo selecionado
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-[rgba(91,140,255,0.10)] flex items-center justify-center">
                      <FileText size={22} className="text-[#5B8CFF]" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-medium text-[#F8FAFC]">{file.name}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <span className="text-[11px] text-[#94A3B8]">
                      Clique para substituir
                    </span>
                  </div>
                ) : (
                  // Estado vazio
                  <div className="flex flex-col items-center gap-3">
                    <div className={cn(
                      "h-12 w-12 rounded-lg flex items-center justify-center transition-all",
                      state === "dragging"
                        ? "bg-[rgba(91,140,255,0.15)]"
                        : "bg-[#1E293B]"
                    )}>
                      <Upload
                        size={22}
                        className={cn(
                          "transition-colors",
                          state === "dragging" ? "text-[#5B8CFF]" : "text-[#64748B]"
                        )}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-medium text-[#F8FAFC]">
                        {state === "dragging" ? "Solte o arquivo" : "Arraste o edital aqui"}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        ou clique para selecionar · PDF, max 50MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de upload */}
              {state === "selected" && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 mt-4"
                >
                  <Button
                    onClick={handleUpload}
                    className="flex-1 glow-pulse"
                  >
                    <Upload size={15} />
                    Processar Edital
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleReset}
                    size="md"
                  >
                    Cancelar
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── ESTADO: UPLOADING / PROCESSING ─────────────── */}
          {(state === "uploading" || state === "processing") && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#111827] border border-[#1F2937] rounded-lg p-8"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="h-10 w-10 rounded-lg bg-[rgba(91,140,255,0.10)] flex items-center justify-center flex-shrink-0">
                  <Loader2 size={20} className="text-[#5B8CFF] animate-spin" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#F8FAFC] mb-0.5">
                    Processando edital
                  </p>
                  <p className="text-[12px] text-[#94A3B8]">{etapa}</p>
                </div>
                <span className="ml-auto text-[13px] font-semibold text-[#5B8CFF]">
                  {progress}%
                </span>
              </div>

              {/* Barra de progresso */}
              <div className="h-1 bg-[#1E293B] rounded-full overflow-hidden mb-6">
                <motion.div
                  className="h-full bg-[#5B8CFF] rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>

              {/* Etapas */}
              <div className="space-y-2.5">
                {ETAPAS.filter((e) => e.id !== "done").map((e) => {
                  const currentIdx = ETAPAS.findIndex((et) => et.id === state) + 1;
                  const etapaIdx   = ETAPAS.findIndex((et) => et.id === e.id);
                  const isDone     = etapaIdx < currentIdx;
                  const isCurrent  = e.id === state;

                  return (
                    <div key={e.id} className="flex items-center gap-3">
                      <div className={cn(
                        "h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0",
                        isDone   ? "bg-[rgba(34,197,94,0.15)]" :
                        isCurrent? "bg-[rgba(91,140,255,0.15)]" :
                                   "bg-[#1E293B]"
                      )}>
                        {isDone ? (
                          <CheckCircle2 size={10} className="text-[#22C55E]" />
                        ) : isCurrent ? (
                          <Loader2 size={10} className="text-[#5B8CFF] animate-spin" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-[#64748B]" />
                        )}
                      </div>
                      <span className={cn(
                        "text-[12px]",
                        isDone    ? "text-[#22C55E]" :
                        isCurrent ? "text-[#F8FAFC] font-medium" :
                                    "text-[#64748B]"
                      )}>
                        {e.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── ESTADO: DONE ────────────────────────────────── */}
          {state === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#111827] border border-[rgba(34,197,94,0.2)] rounded-lg p-8 text-center"
            >
              <div className="inline-flex h-14 w-14 rounded-xl bg-[rgba(34,197,94,0.10)] items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-[#22C55E]" />
              </div>
              <h3 className="text-lg font-semibold text-[#F8FAFC] mb-2">
                Edital ativado
              </h3>
              <p className="text-sm text-[#94A3B8]">
                Sistema configurado. Redirecionando para o dashboard...
              </p>
            </motion.div>
          )}

          {/* ── ESTADO: ERROR ────────────────────────────────── */}
          {state === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-[#111827] border border-[rgba(239,68,68,0.2)] rounded-lg p-8"
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-[rgba(239,68,68,0.10)] flex items-center justify-center flex-shrink-0">
                  <XCircle size={20} className="text-[#EF4444]" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-[#F8FAFC] mb-1">
                    Erro no processamento
                  </p>
                  <p className="text-[12px] text-[#94A3B8]">
                    {errorMsg}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                className="mt-5"
              >
                Tentar novamente
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── INFO ──────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mt-6 p-4 rounded-lg bg-[#111827] border border-[#1F2937]">
          <AlertCircle size={14} className="text-[#64748B] flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            O edital é processado localmente e não é compartilhado.
            Editais de bancas como CESPE, FCC, VUNESP e similares são suportados.
            O processamento leva entre 30 e 90 segundos.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
