"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExamReport } from "@/features/exam/components/libre/exam-report";
import type { ExamRecord } from "@/features/exam/lib/libre";
import { useUniTheme } from "@/features/exam/lib/uni-theme";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { PanelShell } from "@/features/modes/components/panel-shell";

import { errorMessage, getTutorExamRecord } from "../services/tutor-service";

/**
 * Examen completo y guía de errores de un estudiante vinculado (`?id=`), con el mismo reporte que ve el alumno.
 * Fuera de las pestañas del panel: pantalla completa con los colores de su universidad.
 */
export function TutorExamPage() {
  return (
    <ModeGuard mode="parent">
      <React.Suspense fallback={<Loading />}>
        <Loader />
      </React.Suspense>
    </ModeGuard>
  );
}

function Loader() {
  const id = Number(useSearchParams().get("id"));
  const [record, setRecord] = React.useState<ExamRecord | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return setRecord(null);
    let active = true;
    getTutorExamRecord(id)
      .then((r) => active && setRecord(r))
      .catch((e: unknown) => active && setError(errorMessage(e, "No pudimos cargar el examen.")));
    return () => {
      active = false;
    };
  }, [id]);

  useUniTheme(record ? record.target.institucion.colorId : undefined);

  if (error || record === null) {
    return (
      <PanelShell>
        <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-6">
          <p role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleAlert className="size-4 shrink-0" /> {error ?? "No encontramos este examen."}
          </p>
          <Button asChild variant="outline">
            <Link href="/app/dashboard">Volver al panel</Link>
          </Button>
        </div>
      </PanelShell>
    );
  }
  if (record === undefined) return <Loading />;
  return <ExamReport record={record} tutor />;
}

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Cargando examen">
      <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
    </div>
  );
}
