import { FileJson } from "lucide-react";

import { AdminModule } from "./admin-module";

export function IngestWorkspace() {
  return (
    <AdminModule
      icon={FileJson}
      highlight
      eyebrow="/admin/ingest"
      title="Módulo: Ingesta y Banco de Preguntas"
      description="Espacio reservado para la importación masiva de reactivos mediante archivos JSON (Preguntas, Variantes, Ponderaciones y Explicaciones de IA)."
    />
  );
}
