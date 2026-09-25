import { FileJson } from "lucide-react";

import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";

export function IngestWorkspace() {
  return (
    <WorkspacePlaceholder
      icon={FileJson}
      route="/admin/ingest"
      title="Espacio de Trabajo: Backoffice de Ingesta de Preguntas (JSON)"
      description="Carga, validación y previsualización de bancos de preguntas."
      className="min-h-[60dvh]"
    />
  );
}
