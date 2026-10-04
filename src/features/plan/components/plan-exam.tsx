"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExamDisclaimer } from "@/features/exam/components/libre/exam-disclaimer";
import { ExamRunner } from "@/features/exam/components/libre/exam-runner";
import { resolveTarget } from "@/features/exam/components/libre/exam-setup";
import { type ExamConfig, type ExamItem, pickTotal, timeLimitOf } from "@/features/exam/lib/libre";
import { useUniTheme } from "@/features/exam/lib/uni-theme";
import type { AnswerSheet } from "@/features/exam/services/libre-service";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { PanelShell } from "@/features/modes/components/panel-shell";

import { generarExamenPlan, getMyPlans, guardarExamenPlan, nivelPlan } from "../services/plan-service";

/**
 * Examen del plan, sin fricción: la sesión llega en `?sesion=` desde el home y se salta toda configuración.
 * Carrera, dificultad y volumen los decide el plan; se abre directo el aviso mientras se arma el examen,
 * y luego el mismo examen del Examen Libre (mimetización, relojes, vistas y guardado inmutable).
 * `?prueba=1` (⚠️ temporal, igual que en Examen Libre) arma un examen corto para probar.
 */
export function PlanExamPage() {
  return (
    <ModeGuard mode="student">
      <React.Suspense fallback={<Loading />}>
        <PlanExamFlow />
      </React.Suspense>
    </ModeGuard>
  );
}

type Stage = { step: "prep"; items: ExamItem[] | null; error: string | null } | { step: "run"; items: ExamItem[] };

function PlanExamFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const sesionId = Number(params.get("sesion"));
  const prueba = params.get("prueba") === "1";
  const [config, setConfig] = React.useState<ExamConfig | null>(null);
  const [fatal, setFatal] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<Stage>({ step: "prep", items: null, error: null });
  const [attempt, setAttempt] = React.useState(0);

  // 1. La sesión, su carrera y la dificultad que le toca (un error aquí no tiene reintento: se regresa al home).
  React.useEffect(() => {
    if (!Number.isInteger(sesionId) || sesionId <= 0) return setFatal("No encontramos este examen de tu plan.");
    let active = true;
    (async () => {
      const plan = (await getMyPlans()).find((p) => p.sessions.some((s) => s.id === sesionId));
      const sesion = plan?.sessions.find((s) => s.id === sesionId);
      if (!plan || !sesion) throw new Error("Este examen ya no está en tu plan activo.");
      if (sesion.status === "completado") throw new Error("Ya presentaste este examen.");
      const resolved = await resolveTarget(plan.careerId);
      if (resolved.status !== "ok") throw new Error(`Aún no hay preguntas para ${plan.careerName}. Vuelve pronto.`);
      const nivel = await nivelPlan(plan.id);
      if (active) setConfig({ ...resolved.target, nivel, prueba });
    })().catch((e: unknown) => active && setFatal(e instanceof Error ? e.message : "No pudimos cargar tu examen."));
    return () => {
      active = false;
    };
  }, [sesionId, prueba]);

  // 2. Se arma mientras lee el aviso (la base vuelve a calcular la misma dificultad y la valida al guardar).
  React.useEffect(() => {
    if (!config) return;
    let active = true;
    generarExamenPlan(sesionId, pickTotal(config.nivel, config.prueba))
      .then((exam) => active && setStage({ step: "prep", items: exam.items, error: null }))
      .catch((e: unknown) => active && setStage({ step: "prep", items: null, error: e instanceof Error ? e.message : "No pudimos armar tu examen." }));
    return () => {
      active = false;
    };
  }, [config, sesionId, attempt]);

  useUniTheme(config ? config.institucion.id : undefined);

  const save = React.useCallback((sheet: AnswerSheet) => guardarExamenPlan(sesionId, sheet), [sesionId]);
  const onFinished = React.useCallback((id: number) => router.replace(`/app/student/exam/resultado?id=${id}`), [router]);

  if (fatal) return <Notice text={fatal} />;
  if (!config) return <Loading />;
  if (stage.step === "run") return <ExamRunner config={config} items={stage.items} onFinished={onFinished} save={save} />;

  const { items, error } = stage;
  return (
    <ExamDisclaimer
      config={config}
      kicker="Examen del plan"
      backLabel="Regresar a mi home"
      summary={items ? { preguntas: items.length, segundos: timeLimitOf(items) } : null}
      error={error}
      onBack={() => router.push("/app/student")}
      onRetry={() => {
        setStage({ step: "prep", items: null, error: null });
        setAttempt((a) => a + 1);
      }}
      onAccept={() => items && setStage({ step: "run", items })}
    />
  );
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

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Cargando examen">
      <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
    </div>
  );
}
