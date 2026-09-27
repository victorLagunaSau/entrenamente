"use client";

import * as React from "react";
import { FileJson, Plus, Table2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPageHeader } from "@/features/admin/components/admin-module";

import { loadMaterias } from "../services/questions-service";
import type { Pregunta } from "../types";
import { BulkImportTab } from "./bulk-import-tab";
import { CatalogTab } from "./catalog-tab";
import { QuestionForm } from "./question-form";
import { QuestionPreviewDialog } from "./question-preview-dialog";

type TabId = "catalog" | "new" | "import";

const TABS: { id: TabId; label: string; short: string; icon: typeof Table2 }[] = [
  { id: "catalog", label: "Catálogo", short: "Catálogo", icon: Table2 },
  { id: "new", label: "Pregunta", short: "Pregunta", icon: Plus },
  { id: "import", label: "Carga masiva", short: "JSON", icon: FileJson },
];

/** Banco de preguntas (/admin/ingest) sobre Supabase (services/questions-service). */
export function IngestWorkspace() {
  const [tab, setTab] = React.useState<TabId>("catalog");
  const [editing, setEditing] = React.useState<Pregunta | null>(null);
  const [previewing, setPreviewing] = React.useState<Pregunta | null>(null);
  // Se incrementa tras guardar, importar o eliminar para que el catálogo repita la búsqueda.
  const [version, setVersion] = React.useState(0);
  const refresh = React.useCallback(() => setVersion((v) => v + 1), []);

  // Catálogo de materias desde la base (el importador puede agregar nuevas).
  React.useEffect(() => {
    loadMaterias().then(refresh, () => undefined);
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="/admin/ingest"
        title="Banco de Preguntas"
        description="Consulta y edición en el catálogo, alta de preguntas e importación masiva por JSON."
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
          <CatalogTab version={version} onEdit={setEditing} onPreview={setPreviewing} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="new" forceMount className="data-[state=inactive]:hidden">
          <QuestionForm editing={null} onPreview={setPreviewing} onSaved={refresh} />
        </TabsContent>
        <TabsContent value="import" forceMount className="data-[state=inactive]:hidden">
          <BulkImportTab onImported={refresh} onPreview={setPreviewing} />
        </TabsContent>
      </Tabs>

      {/* Edición: ventana sobre el catálogo, sin perder la búsqueda. */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="gap-4 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Editar <span className="font-mono text-base text-gold">{editing?.id}</span>
            </DialogTitle>
            <DialogDescription>Los cambios aplican solo a esta pregunta. Las carreras quedan como las marques.</DialogDescription>
          </DialogHeader>
          {editing && (
            <QuestionForm
              key={`${editing.id}-${editing.actualizado}`}
              editing={editing}
              inDialog
              onPreview={setPreviewing}
              onSaved={() => {
                setEditing(null);
                refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <QuestionPreviewDialog question={previewing} onClose={() => setPreviewing(null)} />
    </div>
  );
}
