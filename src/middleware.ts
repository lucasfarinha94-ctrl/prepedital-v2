// ============================================================
// MIDDLEWARE V2 — 3 camadas: Auth → Edital Guard → Feature Gate
// Executa na Edge Runtime do Next.js (sem Node.js APIs)
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ────────────────────────────────────────────────────────────
// DEFINIÇÃO DE ROTAS
// ────────────────────────────────────────────────────────────

// Rotas que exigem autenticação
const PROTECTED_ROUTES = [
  "/overview",
  "/upload",
  "/dashboard",
  "/conteudo",
  "/questoes",
  "/simulados",
  "/revisao",
  "/estatisticas",
];

// Rotas que exigem edital ativo (fase-2)
const EDITAL_REQUIRED_ROUTES = [
  "/dashboard",
  "/conteudo",
  "/questoes",
  "/simulados",
  "/revisao",
  "/estatisticas",
];

// Rotas públicas (login, cadastro, landing)
const PUBLIC_ROUTES = ["/", "/login", "/cadastro", "/pricing", "/api/auth"];

// ────────────────────────────────────────────────────────────
// SECURITY HEADERS
// ────────────────────────────────────────────────────────────

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;"
  );
  return response;
}

// ────────────────────────────────────────────────────────────
// HELPER — verificar se path corresponde a lista de padrões
// ────────────────────────────────────────────────────────────

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => {
    if (route === pathname) return true;
    // Suporta prefixo: /dashboard → /dashboard/qualquer-coisa
    if (pathname.startsWith(route + "/")) return true;
    return false;
  });
}

// ────────────────────────────────────────────────────────────
// MIDDLEWARE PRINCIPAL
// ────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Em desenvolvimento: bypass total de auth para preview
  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  // Ignorar assets estáticos e rotas internas do Next
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // ── CAMADA 1: AUTENTICAÇÃO ──────────────────────────────
  // Rotas públicas passam direto
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    return applySecurityHeaders(response);
  }

  // Em desenvolvimento sem secret configurado, permitir acesso livre
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    return applySecurityHeaders(response);
  }

  // Buscar JWT do NextAuth (compatível com Edge Runtime)
  const token = await getToken({
    req:    request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });

  // Se não autenticado e rota protegida → redirecionar para login
  if (!token && matchesRoute(pathname, PROTECTED_ROUTES)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Se autenticado e tentando acessar login → redirecionar para overview
  if (token && (pathname === "/login" || pathname === "/cadastro")) {
    return NextResponse.redirect(new URL("/overview", request.url));
  }

  // ── CAMADA 2: EDITAL GUARD ─────────────────────────────
  // Verificar se a rota exige edital ativo
  if (token && matchesRoute(pathname, EDITAL_REQUIRED_ROUTES)) {
    // O cookie "active-edital-id" é setado pelo client após processamento
    // Em produção: validar contra DB via API Route (edge não tem Prisma)
    const activeEditalId = request.cookies.get("active-edital-id")?.value;

    if (!activeEditalId) {
      // Redirecionar para upload com mensagem de contexto
      const uploadUrl = new URL("/upload", request.url);
      uploadUrl.searchParams.set("reason", "edital-required");
      return NextResponse.redirect(uploadUrl);
    }
  }

  // ── CAMADA 3: FEATURE GATING (rotas premium) ───────────
  // Verificar plano do usuário via JWT claim
  const userPlan = (token?.plan as string) || "FREE";

  const PLAN_ROUTES: Record<string, string[]> = {
    // Rotas que exigem pelo menos PRO
    PRO: ["/simulados", "/revisao"],
    // Rotas que exigem ELITE
    ELITE: ["/estatisticas/avancado"],
    // Rotas exclusivas do FOUNDER
    FOUNDER: ["/admin", "/debug"],
  };

  for (const [requiredPlan, routes] of Object.entries(PLAN_ROUTES)) {
    if (matchesRoute(pathname, routes)) {
      const planOrder = ["FREE", "PRO", "ELITE", "FOUNDER"];
      const userPlanIndex = planOrder.indexOf(userPlan);
      const requiredPlanIndex = planOrder.indexOf(requiredPlan);

      if (userPlanIndex < requiredPlanIndex) {
        // Redirecionar para upgrade com contexto
        const upgradeUrl = new URL("/pricing", request.url);
        upgradeUrl.searchParams.set("feature", pathname.split("/")[1]);
        upgradeUrl.searchParams.set("required", requiredPlan.toLowerCase());
        return NextResponse.redirect(upgradeUrl);
      }
    }
  }

  return applySecurityHeaders(response);
}

// Configurar quais rotas passam pelo middleware
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
