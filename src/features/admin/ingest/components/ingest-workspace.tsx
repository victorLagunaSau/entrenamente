"use client";

import * as React from "react";
import { FileJson, PencilLine, Table2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPageHeader } from "@/features/admin/components/admin-module";

import { loadMaterias } from "../services/questions-service";
import type { Pregunta } from "../types";
import { BulkImportTab } from "./bulk-import-tab";
import { CatalogTab } from "./catalog-tab";
import { QuestionForm } from "./question-form";
import { QuestionPreviewDialog } from "./question-preview-dialog";

type TabId = "catalog" | "form" | "import";

const TABS: { id: TabId; label: string; short: string; icon: typeof Table2 }[] = [
  { id: "catalog", label: "Catálogo", short: "Catálogo", icon: Table2 },
  { id: "form", label: "Captura / Edición", short: "Captura", icon: PencilLine },
  { id: "import", label: "Carga masiva", short: "JSON", icon: FileJson },
];

/** Banco de preguntas (/admin/ingest) sobre Supabase (services/questions-service). */
export function IngestWorkspace() {
  const [tab, setTab] = React.useState<TabId>("catalog");
  const [editing, setEditing] = React.useState<Pregunta | null>(null);
  // Cambia la key del formulario para reiniciarlo al editar otra pregunta o empezar una nueva.
  const [formKey, setFormKey] = React.useState(0);
  const [previewing, setPreviewing] = React.useState<Pregunta | null>(null);
  // Se incrementa tras guardar, importar o eliminar para que el catálogo repita la búsqueda.
  const [version, setVersion] = React.useState(0);
  const refresh = React.useCallback(() => setVersion((v) => v + 1), []);

  // Catálogo de materias desde la base (el importador puede agregar nuevas).
  React.useEffect(() => {
    loadMaterias().then(refresh, () => undefined);
  }, [refresh]);

  const edit = (q: Pregunta | null) => {
    setEditing(q);
    setFormKey((k) => k + 1);
    setTab("form");
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="/admin/ingest"
        title="Banco de Preguntas"
        description="Búsqueda en el catálogo, captura y edición de reactivos, e importación masiva por JSON."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="gap-5">
        <TabsList className="h-12">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5 px-1.5 text-xs sm:text-sm">
              <t.icon className="size-4 shrink-0" />
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* forceMount conserva la búsqueda, el borrador y el JSON al cambiar de pestaña. */}
        <TabsContent value="catalog" forceMount className="data-[state=inactive]:hidden">
          <CatalogTab version={version} onEdit={edit} onPreview={setPreviewing} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="form" forceMount className="data-[state=inactive]:hidden">
          <QuestionForm
            key={formKey}
            editing={editing}
            onNew={() => edit(null)}
            onPreview={setPreviewing}
            onSaved={(q) => {
              setEditing(q);
              refresh();
            }}
          />
        </TabsContent>
        <TabsContent value="import" forceMount className="data-[state=inactive]:hidden">
          <BulkImportTab onImported={refresh} onPreview={setPreviewing} />
        </TabsContent>
      </Tabs>

      <QuestionPreviewDialog question={previewing} onClose={() => setPreviewing(null)} />
    </div>
  );
}
