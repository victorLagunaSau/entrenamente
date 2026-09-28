"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Flame, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { getRachaHistory } from "@/features/student/services/exam-record-service";
import { getStudentSummary } from "@/features/student/services/student-service";

import type { ExamRecord, ExamTarget } from "../../lib/libre";
import { diasDeRacha } from "../../lib/racha";
import { ExamenError, getExamRecord } from "../../services/libre-service";
import { generarRacha, type RachaGame } from "../../services/racha-service";
import { resolveTarget, type ResolvedTarget } from "../libre/exam-setup";
import { RachaCountdown, RachaLobby } from "./racha-lobby";
import { PhoneFrame } from "./racha-parts";
import { RachaResult } from "./racha-result";
import { RachaRunner } from "./racha-runner";

/**
 * Modo Racha: lobby (se arma la partida mientras lee los avisos) → cuenta regresiva → trivia vertical → resultado (otra ruta).
 * Pensado primero para el celular; en la web se ve como una columna de teléfono al centro.
 */
export function RachaPage() {
  return (
    <ModeGuard mode="student">
      <React.Suspense fallback={<Loading />}>
        <RachaFlow />
      </React.Suspense>
    </ModeGuard>
  );
}

/** Días seguidos de racha en la carrera (null si aún no se puede saber). */
function useStreakDays(careerId: string | null) {
  const [days, setDays] = React.useState<{ dias: number; jugoHoy: boolean } | null>(null);
  React.useEffect(() => {
    if (!careerId) return;
    let active = true;
    getStudentSummary()
      .then((s) => (s ? getRachaHistory(s.id) : null))
      .then((map) => active && map && setDays(diasDeRacha(map.get(careerId) ?? [])))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [careerId]);
  return days;
}

function RachaFlow() {
  const carreraParam = useSearchParams().get("carrera");
  const [resolved, setResolved] = React.useState<ResolvedTarget | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    resolveTarget(carreraParam)
      .then((r) => active && setResolved(r))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : "No pudimos cargar tu racha."));
    return () => {
      active = false;
    };
  }, [carreraParam]);

  if (error) return <Notice text={error} />;
  if (!resolved) return <Loading />;
  if (resolved.status === "sin-meta") return <Notice text="Aún no tienes una escuela y carrera meta. Elígelas en tu perfil para jugar tu racha." />;
  if (resolved.status === "sin-preguntas") return <Notice text={`Aún no hay preguntas para ${resolved.target?.carrera.nombre ?? "tu carrera"}. Vuelve pronto.`} />;
  return <RachaStages target={resolved.target} />;
}

type Stage = { step: "lobby" } | { step: "countdown" } | { step: "run" };

function RachaStages({ target }: { target: ExamTarget }) {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>({ step: "lobby" });
  const [game, setGame] = React.useState<RachaGame | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const streak = useStreakDays(target.carrera.id);

  React.useEffect(() => {
    let active = true;
    generarRacha(target.carrera.id)
      .then((g) => active && setGame(g))
      .catch((e: unknown) => active && setError(e instanceof ExamenError ? e.message : "No pudimos armar tu partida."));
    return () => {
      active = false;
    };
  }, [target.carrera.id, attempt]);

  const onFinished = React.useCallback((id: number) => router.replace(`/app/student/racha/resultado?id=${id}`), [router]);

  if (stage.step === "lobby" || !game) {
    return (
      <RachaLobby
        target={target}
        game={game}
        streak={streak}
        error={error}
        onRetry={() => {
          setError(null);
          setGame(null);
          setAttempt((a) => a + 1);
        }}
        onStart={() => setStage({ step: "countdown" })}
      />
    );
  }
  if (stage.step === "countdown") return <RachaCountdown onDone={() => setStage({ step: "run" })} />;
  return <RachaRunner target={target} game={game} onFinished={onFinished} />;
}

/* ─────────────────────────── Resultado ─────────────────────────── */

export function RachaResultPage() {
  return (
    <ModeGuard mode="student">
      <React.Suspense fallback={<Loading />}>
        <RachaResultLoader />
      </React.Suspense>
    </ModeGuard>
  );
}

function RachaResultLoader() {
  const params = useSearchParams();
  const folio = params.get("folio");
  const id = Number(params.get("id"));
  const [record, setRecord] = React.useState<ExamRecord | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const streak = useStreakDays(record ? record.target.carrera.id : null);

  React.useEffect(() => {
    const key = folio ? { folio } : Number.isInteger(id) && id > 0 ? { id } : null;
    if (!key) return setRecord(null);
    let active = true;
    getExamRecord(key)
      .then((r) => active && setRecord(r))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : "No pudimos cargar tu racha."));
    return () => {
      active = false;
    };
  }, [id, folio]);

  if (error || record === null) return <Notice text={error ?? "No encontramos esta racha."} />;
  if (record === undefined) return <Loading />;
  return <RachaResult record={record} streak={streak} />;
}

/* ─────────────────────────── Comunes ─────────────────────────── */

function Notice({ text }: { text: string }) {
  return (
    <PhoneFrame>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-energy/15 text-energy">
          <Flame className="size-8" />
        </span>
        <p role="alert" className="flex items-start gap-2 text-sm text-muted-foreground text-pretty">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {text}
        </p>
        <Button asChild variant="outline">
          <Link href="/app/student">Ir a mi home</Link>
        </Button>
      </div>
    </PhoneFrame>
  );
}

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface-deep" role="status" aria-label="Cargando racha">
      <Loader2 className="size-6 animate-spin text-energy motion-reduce:animate-none" />
    </div>
  );
}
