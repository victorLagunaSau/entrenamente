"use client";

import * as React from "react";
import { BookOpen, Check, CheckCircle2, CircleAlert, Lightbulb, ListOrdered, Stethoscope, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatScore } from "../types";
import { MathText } from "./math-text";

/**
 * Piezas visuales de un reactivo. Las comparten el reactivo suelto (ExamQuestion, vista previa del admin),
 * el examen completo (cualquier modo de vista) y el reporte de resultados, para que se vean idénticos.
 */

/** Tono por ponderación: correcta (turquesa), parcial (oro), error (rojo). */
export const scoreTone = (p: number) =>
  p >= 1
    ? "border-success/50 bg-success/10 text-success"
    : p > 0
      ? "border-gold/50 bg-gold/10 text-gold"
      : "border-destructive/50 bg-destructive/10 text-destructive";

export const resultOf = (p: number) =>
  p >= 1
    ? { title: "¡Correcta!", icon: CheckCircle2 }
    : p > 0
      ? { title: "Parcialmente correcta", icon: CircleAlert }
      : { title: "Incorrecta", icon: XCircle };

export const letterAt = (index: number) => String.fromCharCode(65 + index);

export function ReadingBlock({ text, className }: { text: string; className?: string }) {
  return (
    <details open className={cn("group rounded-2xl border bg-background/40 p-4", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <BookOpen className="size-4" /> Lectura
      </summary>
      <MathText text={text} className="mt-3 block max-h-72 overflow-y-auto text-sm leading-relaxed text-cool" />
    </details>
  );
}

export function QuestionPrompt({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-background/60 p-4", className)}>
      <MathText text={text} className="block font-display text-base font-semibold text-balance sm:text-lg" />
    </div>
  );
}

export type OptionItem = { id: number; texto: string; ponderacion?: number };

/**
 * Opciones con letras A, B, C… en el orden recibido.
 * - Sin `reveal`: la elegida se marca en turquesa (se puede cambiar si no está `disabled`).
 * - Con `reveal`: se colorean la elegida y la correcta según su ponderación.
 */
export function AnswerOptions({
  options,
  picked,
  onPick,
  disabled = false,
  reveal = false,
  dimOthers = false,
  className,
}: {
  options: OptionItem[];
  picked: number | null;
  onPick?: (id: number) => void;
  disabled?: boolean;
  reveal?: boolean;
  /** Atenúa las opciones no resaltadas (reactivo ya respondido). */
  dimOthers?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-2.5 sm:grid-cols-2", className)}>
      {options.map((r, i) => {
        const isPicked = picked === r.id;
        const isCorrect = r.ponderacion === 1;
        const highlight = reveal ? isPicked || isCorrect : isPicked;
        return (
          <li key={r.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick?.(r.id)}
              aria-pressed={isPicked}
              className={cn(
                "flex h-full w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                !disabled && "bg-background/40 hover:border-secondary/60 hover:bg-secondary/5",
                highlight && (reveal ? scoreTone(r.ponderacion ?? 0) : "border-secondary bg-secondary/15"),
                reveal && highlight && isCorrect && "shadow-glow-secondary",
                dimOthers && !highlight && "opacity-50"
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold",
                  highlight && reveal && "bg-current/15",
                  highlight && !reveal && "bg-secondary text-secondary-foreground",
                  !highlight && "bg-muted text-muted-foreground"
                )}
              >
                {reveal && isCorrect ? <Check className="size-4" /> : letterAt(i)}
              </span>
              <MathText text={r.texto} className="min-w-0 font-medium text-foreground" />
              {reveal && highlight && <span className="ml-auto shrink-0 font-mono text-xs">{formatScore(r.ponderacion ?? 0)}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Banda de resultado: icono, título, detalle y puntos obtenidos. */
export function ResultBanner({ score, title, detail }: { score: number; title?: string; detail?: React.ReactNode }) {
  const result = resultOf(score);
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border p-3", scoreTone(score))}>
      <result.icon className="size-6 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{title ?? result.title}</p>
        {detail && <p className="text-xs opacity-80">{detail}</p>}
      </div>
      <span className="ml-auto font-display text-2xl font-bold tabular-nums">
        {formatScore(score)}
        <span className="ml-1 text-sm font-medium">pts</span>
      </span>
    </div>
  );
}

/** Diagnóstico del error, respuesta correcta y solución paso a paso. */
export function FeedbackDetails({
  diagnostico,
  correct,
  steps,
  stepByStep = false,
}: {
  diagnostico: string | null | undefined;
  /** Letra (según el orden que vio el alumno) y texto de la opción correcta. */
  correct: { letter: string; texto: string } | null;
  steps: string[];
  /** Muestra la solución de a un paso (reporte de estudio). */
  stepByStep?: boolean;
}) {
  return (
    <>
      {diagnostico && (
        <Feedback icon={Stethoscope} title="Diagnóstico del error">
          <MathText text={diagnostico} className="text-muted-foreground" />
        </Feedback>
      )}
      {correct && (
        <Feedback icon={Lightbulb} title="Respuesta correcta">
          <span className="font-semibold text-success">{correct.letter}) </span>
          <MathText text={correct.texto} className="text-cool" />
        </Feedback>
      )}
      {steps.length > 0 && (
        <Feedback icon={ListOrdered} title="Solución paso a paso">
          {stepByStep ? (
            <SolutionSteps steps={steps} />
          ) : (
            <ol className="mt-1 flex flex-col gap-1.5">
              {steps.map((paso, i) => (
                <li key={i}>
                  <MathText text={paso} className="text-muted-foreground" />
                </li>
              ))}
            </ol>
          )}
        </Feedback>
      )}
    </>
  );
}

/** Solución que se descubre paso a paso: el alumno intenta el siguiente antes de verlo. */
export function SolutionSteps({ steps }: { steps: string[] }) {
  const [shown, setShown] = React.useState(1);
  const all = shown >= steps.length;

  return (
    <div className="mt-2 flex flex-col gap-3">
      <ol className="relative flex flex-col gap-3 border-l-2 border-border pl-4">
        {steps.slice(0, shown).map((paso, i) => (
          <li key={i} className="relative animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
            <span className="absolute top-0 -left-[1.6rem] grid size-5 place-items-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">
              {i + 1}
            </span>
            <MathText text={paso} className="text-foreground" />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        {!all && (
          <>
            <button
              type="button"
              onClick={() => setShown((n) => n + 1)}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Siguiente paso ({shown + 1} de {steps.length})
            </button>
            <button type="button" onClick={() => setShown(steps.length)} className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              Ver todos
            </button>
          </>
        )}
        {all && steps.length > 1 && (
          <button type="button" onClick={() => setShown(1)} className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Repasar desde el paso 1
          </button>
        )}
      </div>
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
