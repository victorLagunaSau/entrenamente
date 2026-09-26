import { Flame } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";

import { StudentWelcome } from "./student-welcome";

export function StudentPanel() {
  return (
    <AppShell variant="student">
      <div className="flex flex-col gap-6">
        <StudentWelcome />
        <WorkspacePlaceholder
          icon={Flame}
          tone="energy"
          route="/app/student"
          title="Espacio de Trabajo: Panel Principal del Estudiante (Exámenes y Rachas)"
          description="Vista gamificada: exámenes activos, rachas, XP y logros."
          className="min-h-[45dvh]"
        />
      </div>
    </AppShell>
  );
}
