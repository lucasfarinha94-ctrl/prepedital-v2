// ============================================================
// ROOT PAGE — redireciona para /overview (fase 1)
// ============================================================

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/overview");
}
