"use client";

import * as React from "react";
import { BookOpen, Check, CheckCircle2, CircleAlert, Lightbulb, ListOrdered, Stethoscope, Timer, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { type AnswerResult, type Reactivo, type Respuesta, formatScore } from "../types";
import { MathText } from "./math-text";

/** Tono por ponderación: correcta (turquesa), parcial (oro), error (rojo). */
export const scoreTone = (p: number) =>
  p >= 1
    ? "border-secondary/50 bg-secondary/10 text-secondary"
    : p > 0
      ? "border-gold/50 bg-gold/10 text-gold"
      : "border-destructive/50 bg-destructive/10 text-destructive";

const resultOf = (p: number) =>
  p >= 1
    ? { title: "¡Correcta!", icon: CheckCircle2 }
    : p > 0
      ? { title: "Parcialmente correcta", icon: CircleAlert }
      : { title: "Incorrecta", icon: XCircle };

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Reactivo de examen tal como lo ve el estudiante: lectura, temporizador, opciones y
 * retroalimentación (ponderación, diagnóstico y solución paso a paso).
 * Es el componente del examen oficial; la vista previa del admin lo reutiliza tal cual.
 * Para reiniciarlo (reintentar, otra pregunta) cambia su `key`.
 */
export function ExamQuestion({
  eyebrow,
  title,
  reactivo,
  seconds: total,
  shuffle = true,
  paused = false,
  showFeedback = true,
  onAnswer,
  footer,
}: {
  /** Ej. "Simulacro · UNAM". */
  eyebrow: string;
  /** Ej. materia o "Reactivo 7 de 20". */
  title: string;
  reactivo: Pick<Reactivo, "pregunta" | "lecturaAsociada" | "respuestas" | "solucionPasoAPaso">;
  /** Tiempo límite en segundos. */
  seconds: number;
  shuffle?: boolean;
  paused?: boolean;
  /** false en exámenes que califican al final sin revelar la respuesta. */
  showFeedback?: boolean;
  onAnswer?: (result: AnswerResult) => void;
  /** Acciones bajo la retroalimentación (reintentar, siguiente…). */
  footer?: React.ReactNode;
}) {
  const { pregunta, lecturaAsociada, respuestas, solucionPasoAPaso } = reactivo;
  const [seconds, setSeconds] = React.useState(total);
  const [picked, setPicked] = React.useState<number | null>(null);
  // El estudiante ve letras A, B, C… en el orden barajado; el id real se conserva para calificar.
  const [order] = React.useState(() => (shuffle ? shuffled(respuestas) : respuestas));

  const timedOut = seconds <= 0 && picked === null;
  const answered = picked !== null || timedOut;

  React.useEffect(() => {
    if (answered || paused) return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [answered, paused]);

  const onAnswerRef = React.useRef(onAnswer);
  React.useEffect(() => {
    onAnswerRef.current = onAnswer;
  });
  React.useEffect(() => {
    if (timedOut) onAnswerRef.current?.({ respuestaId: null, ponderacion: 0, elapsedSeconds: total });
  }, [timedOut, total]);

  const pick = (r: Respuesta) => {
    setPicked(r.id);
    onAnswer?.({ respuestaId: r.id, ponderacion: r.ponderacion, elapsedSeconds: total - seconds });
  };

  const chosen = respuestas.find((r) => r.id === picked) ?? null;
  const correct = respuestas.find((r) => r.ponderacion === 1);
  const score = chosen?.ponderacion ?? 0;
  const result = resultOf(score);
  const reveal = answered && showFeedback;
  const letterOf = (r: Respuesta) => String.fromCharCode(65 + order.indexOf(r));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border bg-card p-4 shadow-xl sm:p-6">
        {/* Cabecera */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-widest text-muted-foreground uppercase">{eyebrow}</p>
            <p className="truncate font-display text-sm font-semibold text-cool">{title}</p>
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5",
              answered || paused ? "border-border bg-muted/40" : "animate-pulse-glow border-energy/60 bg-energy/10"
            )}
            role="timer"
            aria-label={`Tiempo restante ${mm}:${ss}`}
          >
            <Timer className={cn("size-4", answered ? "text-muted-foreground" : "text-energy")} />
            <span className={cn("font-mono text-lg font-bold tabular-nums", answered ? "text-muted-foreground" : "text-energy-glow")}>
              {mm}:{ss}
            </span>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-energy to-gold transition-[width] duration-1000 ease-linear"
            style={{ width: `${((total - seconds) / total) * 100}%` }}
          />
        </div>

        {/* Lectura */}
        {lecturaAsociada && (
          <details open className="group mt-5 rounded-2xl border bg-background/40 p-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              <BookOpen className="size-4" /> Lectura
            </summary>
            <MathText text={lecturaAsociada} className="mt-3 block max-h-72 overflow-y-auto text-sm leading-relaxed text-cool" />
          </details>
        )}

        {/* Pregunta */}
        <div className="mt-5 rounded-2xl border bg-background/60 p-4">
          <MathText text={pregunta} className="block font-display text-base font-semibold text-balance sm:text-lg" />
        </div>

        {/* Opciones */}
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {order.map((r) => {
            const isPicked = picked === r.id;
            const highlight = reveal ? isPicked || r.ponderacion === 1 : isPicked;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={answered || paused}
                  onClick={() => pick(r)}
                  className={cn(
                    "flex h-full w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    !answered && "bg-background/40 hover:border-secondary/60 hover:bg-secondary/5",
                    highlight && (reveal ? scoreTone(r.ponderacion) : "border-secondary bg-secondary/15"),
                    reveal && highlight && r.ponderacion === 1 && "shadow-glow-secondary",
                    answered && !highlight && "opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold",
                      highlight ? "bg-current/15" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {reveal && r.ponderacion === 1 ? <Check className="size-4" /> : letterOf(r)}
                  </span>
                  <MathText text={r.texto} className="min-w-0 font-medium text-foreground" />
                  {reveal && highlight && <span className="ml-auto shrink-0 font-mono text-xs">{formatScore(r.ponderacion)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Retroalimentación */}
      {reveal && (
        <section className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-5" aria-live="polite">
          <div className={cn("flex items-center gap-3 rounded-2xl border p-3", scoreTone(score))}>
            <result.icon className="size-6 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">{timedOut ? "Tiempo agotado" : result.title}</p>
              <p className="text-xs opacity-80">
                Tiempo usado: {total - seconds} s de {total} s
              </p>
            </div>
            <span className="ml-auto font-display text-2xl font-bold tabular-nums">
              {formatScore(score)}
              <span className="ml-1 text-sm font-medium">pts</span>
            </span>
          </div>

          {chosen?.diagnosticoError && (
            <Feedback icon={Stethoscope} title="Diagnóstico del error">
              <MathText text={chosen.diagnosticoError} className="text-muted-foreground" />
            </Feedback>
          )}
          {correct && (
            <Feedback icon={Lightbulb} title="Respuesta correcta">
              <span className="font-semibold text-secondary">{letterOf(correct)}) </span>
              <MathText text={correct.texto} className="text-cool" />
            </Feedback>
          )}
          {solucionPasoAPaso.length > 0 && (
            <Feedback icon={ListOrdered} title="Solución paso a paso">
              <ol className="mt-1 flex flex-col gap-1.5">
                {solucionPasoAPaso.map((paso, i) => (
                  <li key={i}>
                    <MathText text={paso} className="text-muted-foreground" />
                  </li>
                ))}
              </ol>
            </Feedback>
          )}
          {footer}
        </section>
      )}
    </div>
  );
}

function Feedback({ icon: Icon, title, children }: { icon: typeof Lightbulb; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-brand-light">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}
