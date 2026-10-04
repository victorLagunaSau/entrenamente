"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { PanelShell } from "@/features/modes/components/panel-shell";

import type { Dificultad } from "../../types";
import { type ExamConfig, type ExamItem, type ExamRecord, type ExamTarget, pickTotal, timeLimitOf } from "../../lib/libre";
import { useUniTheme } from "../../lib/uni-theme";
import { ExamenError, generarExamen, getExamRecord } from "../../services/libre-service";
import { ExamDisclaimer } from "./exam-disclaimer";
import { ExamReport } from "./exam-report";
import { ExamRunner } from "./exam-runner";
import { ExamLevelPicker, resolveTarget, type ResolvedTarget } from "./exam-setup";

type Stage =
  | { step: "nivel" }
  | { step: "prep"; config: ExamConfig; items: ExamItem[] | null; error: string | null }
  | { step: "run"; config: ExamConfig; items: ExamItem[] };

/** Modo Examen Libre: dificultad → indicaciones (mientras se arma) → examen → reporte (otra ruta). */
export function ExamLibrePage() {
  return (
    <ModeGuard mode="student">
      <React.Suspense fallback={<Loading />}>
        <ExamLibreFlow />
      </React.Suspense>
    </ModeGuard>
  );
}

function ExamLibreFlow() {
  const carreraParam = useSearchParams().get("carrera");
  const [resolved, setResolved] = React.useState<ResolvedTarget | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    resolveTarget(carreraParam)
      .then((r) => active && setResolved(r))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : "No pudimos cargar tu examen."));
    return () => {
      active = false;
    };
  }, [carreraParam]);

  const target = resolved && resolved.status !== "sin-meta" ? resolved.target : null;
  useUniTheme(target ? target.institucion.id : undefined);

  if (error) return <Notice text={error} />;
  if (!resolved) return <Loading />;
  if (resolved.status === "sin-meta") return <Notice text="Aún no tienes una escuela y carrera meta. Elígelas en tu perfil para presentar exámenes." />;
  if (resolved.status === "sin-preguntas")
    return <Notice text={`Aún no hay preguntas para ${resolved.target?.carrera.nombre ?? "tu carrera"}. Vuelve pronto.`} />;
  return <ExamStages target={resolved.target} conteo={resolved.conteo} />;
}

function ExamStages({ target, conteo }: { target: ExamTarget; conteo: Record<Dificultad, number> }) {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>({ step: "nivel" });
  const [attempt, setAttempt] = React.useState(0);

  const prepConfig = stage.step === "prep" ? stage.config : null;

  React.useEffect(() => {
    if (!prepConfig) return;
    let active = true;
    generarExamen(prepConfig.carrera.id, prepConfig.nivel, pickTotal(prepConfig.nivel, prepConfig.prueba))
      .then((items) => active && setStage({ step: "prep", config: prepConfig, items, error: null }))
      .catch(
        (e: unknown) =>
          active && setStage({ step: "prep", config: prepConfig, items: null, error: e instanceof ExamenError ? e.message : "No pudimos armar tu examen." })
      );
    return () => {
      active = false;
    };
  }, [prepConfig, attempt]);

  const onFinished = React.useCallback((id: number) => router.replace(`/app/student/exam/resultado?id=${id}`), [router]);

  if (stage.step === "nivel") {
    return (
      <ExamLevelPicker
        target={target}
        conteo={conteo}
        onPick={(nivel, prueba) => setStage({ step: "prep", config: { ...target, nivel, prueba }, items: null, error: null })}
      />
    );
  }

  if (stage.step === "prep") {
    const { config, items, error } = stage;
    return (
      <ExamDisclaimer
        config={config}
        summary={items ? { preguntas: items.length, segundos: timeLimitOf(items) } : null}
        error={error}
        onBack={() => setStage({ step: "nivel" })}
        onRetry={() => {
          setStage({ step: "prep", config, items: null, error: null });
          setAttempt((a) => a + 1);
        }}
        onAccept={() => items && setStage({ step: "run", config, items })}
      />
    );
  }

  return <ExamRunner config={stage.config} items={stage.items} onFinished={onFinished} />;
}

function Notice({ text }: { text: string }) {
  return (
    <PanelShell>
      <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-6">
        <p role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleAlert className="size-4 shrink-0" /> {text}
        </p>
        <Button asChild variant="outline">
          <Link href="/app/student">Ir a mi home</Link>
        </Button>
      </div>
    </PanelShell>
  );
}

/* ─────────────────────────── Resultado / visor histórico ─────────────────────────── */

export function ExamResultPage() {
  return (
    <ModeGuard mode="student">
      <React.Suspense fallback={<Loading />}>
        <ExamResultLoader />
      </React.Suspense>
    </ModeGuard>
  );
}

function ExamResultLoader() {
  const params = useSearchParams();
  const folio = params.get("folio");
  const id = Number(params.get("id"));
  const [record, setRecord] = React.useState<ExamRecord | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const key = folio ? { folio } : Number.isInteger(id) && id > 0 ? { id } : null;
    if (!key) return setRecord(null);
    let active = true;
    getExamRecord(key)
      .then((r) => active && setRecord(r))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : "No pudimos cargar el examen."));
    return () => {
      active = false;
    };
  }, [id, folio]);

  useUniTheme(record ? record.target.institucion.id : undefined);

  if (error || record === null) return <Notice text={error ?? "No encontramos este examen."} />;
  if (record === undefined) return <Loading />;
  return <ExamReport record={record} />;
}

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Cargando examen">
      <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
    </div>
  );
}
