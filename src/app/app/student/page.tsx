import type { Metadata } from "next";
import { Flame } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";

export const metadata: Metadata = { title: "Estudiante · ExaMente" };

export default function StudentPage() {
  return (
    <AppShell variant="student">
      <WorkspacePlaceholder
        icon={Flame}
        route="/app/student"
        title="Espacio de Trabajo: Panel Principal del Estudiante (Exámenes y Rachas)"
        description="Vista gamificada: exámenes activos, rachas, XP y logros."
        className="min-h-[60dvh]"
      />
    </AppShell>
  );
}
