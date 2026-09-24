import type { Metadata } from "next";
import { LineChart } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";
import { brandIcons } from "@/lib/brand";

// Versión maestro: favicon de la tabla con check.
export const metadata: Metadata = { title: "Dashboard", icons: brandIcons("maestro") };

export default function DashboardPage() {
  return (
    <AppShell variant="dashboard">
      <div className="flex flex-col gap-6">
        {/* Esqueleto de KPIs para validar el layout de métricas */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {["Alumnos", "Promedio", "Exámenes", "Racha media"].map((kpi) => (
            <div key={kpi} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{kpi}</p>
              <p className="mt-2 font-display text-2xl font-semibold text-cool">—</p>
            </div>
          ))}
        </div>
        <WorkspacePlaceholder
          icon={LineChart}
          route="/app/dashboard"
          title="Espacio de Trabajo: Dashboard de Seguimiento Multialumno / Multihijo"
          description="Vista ejecutiva: métricas, tablas planas y comparativas por alumno."
          className="min-h-[45dvh]"
        />
      </div>
    </AppShell>
  );
}
