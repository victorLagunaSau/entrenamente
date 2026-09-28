"use client";

import * as React from "react";
import { Timer } from "lucide-react";

import { cn } from "@/lib/utils";

import { shuffled } from "../lib/shuffle";
import type { AnswerResult, Reactivo, Respuesta } from "../types";
import { AnswerOptions, FeedbackDetails, letterAt, QuestionPrompt, ReadingBlock, ResultBanner } from "./question-parts";

export { scoreTone } from "./question-parts";

/**
 * Reactivo de examen tal como lo ve el estudiante: lectura, temporizador, opciones y
 * retroalimentación (ponderación, diagnóstico y solución paso a paso).
 * Reactivo suelto con su propio temporizador (vista previa del admin, práctica de una pregunta).
 * El examen completo (components/libre) arma sus reactivos con las mismas piezas de question-parts.
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

  const pick = (id: number) => {
    const r = respuestas.find((x) => x.id === id) as Respuesta;
    setPicked(r.id);
    onAnswer?.({ respuestaId: r.id, ponderacion: r.ponderacion, elapsedSeconds: total - seconds });
  };

  const chosen = respuestas.find((r) => r.id === picked) ?? null;
  const correct = respuestas.find((r) => r.ponderacion === 1);
  const score = chosen?.ponderacion ?? 0;
  const reveal = answered && showFeedback;
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

        {lecturaAsociada && <ReadingBlock text={lecturaAsociada} className="mt-5" />}
        <QuestionPrompt text={pregunta} className="mt-5" />
        <AnswerOptions
          className="mt-4"
          options={order}
          picked={picked}
          onPick={pick}
          disabled={answered || paused}
          reveal={reveal}
          dimOthers={answered}
        />
      </div>

      {/* Retroalimentación */}
      {reveal && (
        <section className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-5" aria-live="polite">
          <ResultBanner
            score={score}
            title={timedOut ? "Tiempo agotado" : undefined}
            detail={`Tiempo usado: ${total - seconds} s de ${total} s`}
          />
          <FeedbackDetails
            diagnostico={chosen?.diagnosticoError}
            correct={correct ? { letter: letterAt(order.indexOf(correct)), texto: correct.texto } : null}
            steps={solucionPasoAPaso}
          />
          {footer}
        </section>
      )}
    </div>
  );
}
