import type { Metadata } from "next";

import { EscuelasWorkspace } from "@/features/escuelas/components/escuelas-workspace";

export const metadata: Metadata = { title: "Escuelas y carreras" };

export default function AdminEscuelasPage() {
  return <EscuelasWorkspace />;
}
