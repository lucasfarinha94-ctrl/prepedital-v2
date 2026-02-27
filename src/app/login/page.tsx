// ============================================================
// LOGIN PAGE — NextAuth v5
// ============================================================

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Zap, Mail, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email, password, redirect: false,
    });

    if (res?.error) {
      setError("Email ou senha incorretos.");
      setLoading(false);
      return;
    }

    router.push("/overview");
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="h-8 w-8 rounded-lg bg-[#5B8CFF] flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-[15px] font-semibold text-[#F8FAFC] tracking-tight">
            Prep<span className="text-[#5B8CFF]">Edital</span>
          </span>
        </div>

        {/* Card */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-7">
          <h1 className="text-lg font-semibold text-[#F8FAFC] mb-1 text-center">
            Entrar na plataforma
          </h1>
          <p className="text-[12px] text-[#64748B] text-center mb-6">
            Acesse sua preparação estratégica
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-[11px] font-medium text-[#94A3B8] mb-1.5 block uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className={cn(
                    "w-full h-10 pl-9 pr-3 rounded-md text-[13px]",
                    "bg-[#0F172A] border border-[#1F2937]",
                    "text-[#F8FAFC] placeholder:text-[#64748B]",
                    "focus:outline-none focus:border-[#5B8CFF]",
                    "transition-colors"
                  )}
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="text-[11px] font-medium text-[#94A3B8] mb-1.5 block uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={cn(
                    "w-full h-10 pl-9 pr-3 rounded-md text-[13px]",
                    "bg-[#0F172A] border border-[#1F2937]",
                    "text-[#F8FAFC] placeholder:text-[#64748B]",
                    "focus:outline-none focus:border-[#5B8CFF]",
                    "transition-colors"
                  )}
                />
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.2)]">
                <AlertCircle size={13} className="text-[#EF4444] flex-shrink-0" />
                <p className="text-[12px] text-[#EF4444]">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full mt-1">
              Entrar
            </Button>
          </form>

          {/* Dev bypass */}
          <div className="mt-5 pt-4 border-t border-[#1F2937]">
            <p className="text-[11px] text-[#64748B] text-center mb-3">
              Ambiente de desenvolvimento
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-[11px]"
              onClick={() => router.push("/overview")}
            >
              Acessar sem login (dev)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
