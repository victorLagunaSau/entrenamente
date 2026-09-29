"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, CircleCheck, FileText, Gift, Hourglass, Lock, PartyPopper, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { FreeExam } from "../../services/demo-service";
import { DemoSection } from "./demo-section";

type NodeState = "done" | "active" | "locked";

/** Por qué no se puede presentar el siguiente examen (además del orden). */
export type PathBlock = "sin-meta" | "pausa" | "vencido" | null;

const dayFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
const deadlineFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

/**
 * Plan inicial gratuito (stepper): el primer examen activo y los demás con candado; cada examen terminado
 * desbloquea el siguiente, dentro del periodo de prueba. El largo es el de las pruebas del alumno.
 */
export function DemoPath({
  total,
  used,
  exams,
  careerId,
  endsAt,
  block,
  onUnlock,
}: {
  total: number;
  /** Pruebas gastadas: la fuente de verdad del avance. */
  used: number;
  /** Registros de esas pruebas (score y folio), en orden. */
  exams: FreeExam[];
  careerId: string | null;
  endsAt: string | null;
  block: PathBlock;
  onUnlock: () => void;
}) {
  const done = Math.min(used, total);
  const finished = total > 0 && done >= total;
  const stateOf = (i: number): NodeState => (i < done ? "done" : i === done && !block ? "active" : "locked");
  const examHref = careerId ? `/app/student/exam?carrera=${encodeURIComponent(careerId)}` : "";

  return (
    <DemoSection
      id="ruta"
      icon={Gift}
      tone="brand"
      title="Plan inicial gratuito"
      aside={
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 font-mono text-xs font-semibold tabular-nums">
          {done}/{total}
        </span>
      }
    >
      {endsAt && !finished && <TrialTimer endsAt={endsAt} total={total} left={total - done} />}

      {block === "sin-meta" && (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          Aún no tienes una escuela y carrera meta. Elígelas en tu perfil para presentar tus exámenes gratis.
        </p>
      )}
      {block === "pausa" && !finished && (
        <p className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold">
          La prueba gratuita está en pausa por ahora. Entrena sin límites con el Plan Estudiante.
        </p>
      )}

      <ol className="flex flex-col items-stretch gap-2 md:flex-row md:gap-1">
        {Array.from({ length: total }, (_, i) => (
          <li key={i} className="contents">
            {i > 0 && (
              <span aria-hidden className="grid shrink-0 place-items-center text-muted-foreground md:w-6">
                <ArrowDown className="size-4 md:hidden" />
                <ArrowRight className="hidden size-4 md:block" />
              </span>
            )}
            <PathNode
              n={i + 1}
              state={stateOf(i)}
              exam={i < done ? exams[i] : undefined}
              href={examHref}
              lockedText={
                i > done
                  ? `Se desbloquea al finalizar el Examen ${i}.`
                  : block === "vencido"
                    ? "Tu periodo de prueba terminó."
                    : "No disponible por ahora."
              }
            />
          </li>
        ))}
      </ol>

      {(finished || block === "vencido") && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-secondary/40 bg-secondary/10 p-4 sm:flex-row sm:items-center sm:p-5">
          <PartyPopper className="size-6 shrink-0 text-secondary" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-pretty">
            <span className="font-semibold">
              {finished ? `¡Completaste tus ${total} exámenes gratis!` : "Tu periodo de prueba terminó."}
            </span>{" "}
            {done > 0 ? "Tu diagnóstico y tu guía de estudio están abajo. " : ""}Sigue entrenando sin límites con el Plan Estudiante.
          </p>
          <Button variant="energy" onClick={onUnlock} className="w-full sm:w-auto">
            Entrena sin límites
          </Button>
        </div>
      )}
    </DemoSection>
  );
}

/** Cuenta regresiva del periodo de prueba (se actualiza cada minuto). */
function TrialTimer({ endsAt, total, left }: { endsAt: string; total: number; left: number }) {
  const end = React.useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const ms = Math.max(0, end - now);
  if (ms === 0) return null;
  const parts = [
    { value: Math.floor(ms / 86_400_000), label: "días" },
    { value: Math.floor(ms / 3_600_000) % 24, label: "horas" },
    { value: Math.floor(ms / 60_000) % 60, label: "min" },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-light/40 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <p className="flex items-start gap-2.5 text-sm text-pretty">
        <Hourglass className="mt-0.5 size-5 shrink-0 text-brand-light" aria-hidden />
        <span>
          <span className="font-semibold">
            {left === total
              ? `Tienes ${total} ${total === 1 ? "examen gratuito" : "exámenes gratuitos"}`
              : `Te ${left === 1 ? "queda" : "quedan"} ${left} de ${total} exámenes gratuitos`}
          </span>{" "}
          <span className="text-muted-foreground">hasta el {deadlineFmt.format(new Date(end))}</span>
        </span>
      </p>
      <div className="flex gap-2" role="timer" aria-label="Tiempo restante de tu prueba gratuita">
        {parts.map((p) => (
          <span key={p.label} className="flex min-w-16 flex-col items-center rounded-xl border bg-card px-3 py-2">
            <span className="font-display text-2xl font-bold tabular-nums">{String(p.value).padStart(2, "0")}</span>
            <span className="text-[11px] text-muted-foreground">{p.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function PathNode({
  n,
  state,
  exam,
  href,
  lockedText,
}: {
  n: number;
  state: NodeState;
  exam?: FreeExam;
  href: string;
  lockedText: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border bg-card p-4",
        state === "done" && "border-success/40",
        state === "active" && "border-secondary shadow-glow-secondary",
        state === "locked" && "border-dashed bg-card/60"
      )}
      aria-current={state === "active" ? "step" : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Prueba gratuita {n}</p>
        {state === "done" && <CircleCheck className="size-5 text-success" aria-label="Completado" />}
        {state === "locked" && <Lock className="size-4 text-muted-foreground" aria-label="Bloqueado" />}
      </div>

      {state === "done" &&
        (exam ? (
          <>
            <p className="font-display text-3xl font-bold tabular-nums">
              {exam.score}
              <span className="text-base text-muted-foreground"> %</span>
            </p>
            <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{dayFmt.format(new Date(exam.completedAt))}</span>
              <Link
                href={`/app/student/exam/resultado?folio=${encodeURIComponent(exam.folio)}`}
                className="inline-flex items-center gap-1 font-semibold text-brand-light hover:underline"
              >
                <FileText className="size-3.5" /> Reporte
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-success">Completado</p>
        ))}

      {state === "active" && (
        <>
          <p className="text-sm text-cool">{n === 1 ? "Tu diagnóstico empieza aquí." : "¡Ya está desbloqueado!"}</p>
          <Button asChild variant="brand" className="mt-auto w-full">
            <Link href={href}>
              <Play /> Examen {n}
            </Link>
          </Button>
        </>
      )}

      {state === "locked" && (
        <p className="text-sm text-muted-foreground text-pretty">
          <span className="font-semibold">Bloqueado.</span> {lockedText}
        </p>
      )}
    </div>
  );
}
