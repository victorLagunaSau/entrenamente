"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, CircleAlert, Headphones, LayoutGrid, Loader2, Play, Send, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatClock, LETTERS, type PlayerItem, type PlayerSheet } from "../lib/player";
import { SECTION_LABEL } from "../types";

/**
 * Reproductor del examen TOEFL ITP. Toda la interfaz va en inglés, como el examen real.
 * - Contexto a la izquierda (audio y/o pasaje), pregunta a la derecha; en celular, uno sobre otro.
 * - El audio no se puede pausar, adelantar ni regresar y respeta audio_max_plays por asset
 *   (las preguntas que comparten audio comparten sus reproducciones).
 * - Al agotarse el tiempo se entrega solo.
 */
export function ToeflPlayer({
  title,
  items,
  limitSeconds,
  onSubmit,
}: {
  title: string;
  items: PlayerItem[];
  limitSeconds: number;
  /** Guarda el intento; si falla, el error se muestra y se puede reintentar. */
  onSubmit: (sheet: PlayerSheet) => Promise<void>;
}) {
  const total = items.length;
  const [current, setCurrent] = React.useState(0);
  const [answers, setAnswers] = React.useState<(string | null)[]>(() => items.map(() => null));
  const [marked, setMarked] = React.useState<Set<number>>(() => new Set());
  const [reviewing, setReviewing] = React.useState(false);
  const [remaining, setRemaining] = React.useState(limitSeconds);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Tiempo por pregunta: se acumula en la que está a la vista.
  const spent = React.useRef<number[]>(items.map(() => 0));
  const startedAt = React.useRef(Date.now());
  const lastTick = React.useRef(Date.now());
  const done = React.useRef(false);

  const audio = useLimitedAudio();

  const submit = React.useCallback(
    async (agotado: boolean) => {
      if (done.current) return;
      done.current = true;
      audio.stop();
      setSubmitting(true);
      setError(null);
      try {
        await onSubmit({
          respuestas: items.map((q, i) => ({ id: q.id, respuestaId: answers[i], segundos: spent.current[i] })),
          tiempoUsado: Math.min(limitSeconds, (Date.now() - startedAt.current) / 1000),
          agotado,
        });
      } catch (e) {
        done.current = false;
        setSubmitting(false);
        setError(e instanceof Error ? e.message : "We could not submit your test.");
      }
    },
    [answers, audio, items, limitSeconds, onSubmit]
  );

  // Reloj: se calcula contra la hora de inicio para no desfasarse si la pestaña se duerme.
  const submitRef = React.useRef(submit);
  submitRef.current = submit;
  const view = reviewing ? -1 : current;
  const viewRef = React.useRef(view);
  viewRef.current = view;
  React.useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      if (!done.current && viewRef.current >= 0) spent.current[viewRef.current] += (now - lastTick.current) / 1000;
      lastTick.current = now;
      const left = limitSeconds - (now - startedAt.current) / 1000;
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(id);
        void submitRef.current(true);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [limitSeconds]);

  // Evita salir por accidente a media prueba.
  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!done.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const q = items[current];
  const answered = answers.filter((a) => a !== null).length;
  const low = remaining <= 60;

  const go = (i: number) => {
    setReviewing(false);
    setCurrent(Math.min(Math.max(i, 0), total - 1));
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground" lang="en">
      {/* Barra superior */}
      <header className="sticky top-0 z-20 bg-[var(--uni-bar,var(--primary))] text-[var(--school-on-primary,white)] shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
          <span className="font-semibold">{title}</span>
          <span
            className={cn(
              "ml-auto flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono tabular-nums",
              low ? "bg-white/90 text-[#c62828]" : "bg-black/15"
            )}
            role="timer"
            aria-label={`Time left ${formatClock(remaining)}`}
          >
            <Timer className="size-4" /> Time Left: {formatClock(remaining)}
          </span>
        </div>
        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-1.5 text-xs">
            {reviewing ? (
              <span>Review</span>
            ) : (
              <>
                <span>
                  Section: <strong>{SECTION_LABEL[q.section]}</strong>
                </span>
                <span>
                  Question <strong>{current + 1}</strong> of {total}
                </span>
              </>
            )}
            <span className="ml-auto">
              {answered}/{total} answered
            </span>
          </div>
          <div className="h-1 bg-black/15">
            <div className="h-full bg-white/70 transition-all" style={{ width: `${(answered / total) * 100}%` }} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-5">
        {reviewing ? (
          <ReviewGrid items={items} answers={answers} marked={marked} onGo={go} />
        ) : (
          <div className={cn("grid flex-1 content-start gap-5", q.context && "lg:grid-cols-2")}>
            {q.context && (
              <section aria-label="Context" className="flex flex-col gap-4 rounded-xl border bg-card p-4 lg:sticky lg:top-28 lg:max-h-[calc(100dvh-12rem)] lg:self-start">
                {q.context.audioUrl && (
                  <AudioPanel
                    contextId={q.context.id}
                    url={q.context.audioUrl}
                    maxPlays={q.context.audioMaxPlays}
                    audio={audio}
                  />
                )}
                {q.context.readingPassage && (
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-muted/40 p-4 text-[15px] leading-relaxed whitespace-pre-line max-lg:max-h-72">
                    {q.context.readingPassage}
                  </div>
                )}
              </section>
            )}

            <section aria-labelledby="toefl-question" className={cn("flex flex-col gap-4", !q.context && "mx-auto w-full max-w-2xl")}>
              <h2 id="toefl-question" className="text-lg leading-snug font-semibold whitespace-pre-line">
                {q.questionText}
              </h2>
              <div role="radiogroup" aria-labelledby="toefl-question" className="flex flex-col gap-2">
                {q.options.map((o, i) => {
                  const selected = answers[current] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setAnswers((prev) => prev.map((a, j) => (j === current ? (selected ? null : o.id) : a)))}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent",
                        selected && "border-[var(--uni-accent,var(--primary))] ring-2 ring-[var(--uni-accent,var(--primary))]/30"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full border text-sm font-semibold",
                          selected && "border-transparent bg-[var(--uni-accent,var(--primary))] text-[var(--school-on-primary,white)]"
                        )}
                      >
                        {LETTERS[i] ?? o.id}
                      </span>
                      <span className="pt-0.5">{o.texto}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" /> {error}
          </p>
        )}
      </main>

      {/* Pie */}
      <footer className="sticky bottom-0 z-20 border-t bg-card/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          {reviewing ? (
            <>
              <Button type="button" variant="outline" onClick={() => go(current)} disabled={submitting}>
                <ArrowLeft /> Return to Test
              </Button>
              <Button type="button" className="ml-auto" onClick={() => submit(false)} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <Send />} Submit Test
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => go(current - 1)} disabled={current === 0}>
                <ArrowLeft /> <span className="max-sm:sr-only">Previous</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-pressed={marked.has(current)}
                onClick={() =>
                  setMarked((prev) => {
                    const next = new Set(prev);
                    if (next.has(current)) next.delete(current);
                    else next.add(current);
                    return next;
                  })
                }
              >
                {marked.has(current) ? <BookmarkCheck className="text-gold" /> : <Bookmark />}
                <span className="max-sm:sr-only">{marked.has(current) ? "Marked" : "Mark for Review"}</span>
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setReviewing(true)} aria-label="Review all questions">
                <LayoutGrid />
              </Button>
              {current < total - 1 ? (
                <Button type="button" className="ml-auto" onClick={() => go(current + 1)}>
                  Next Question <ArrowRight />
                </Button>
              ) : (
                <Button type="button" className="ml-auto" onClick={() => setReviewing(true)}>
                  Review & Submit <ArrowRight />
                </Button>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────── Revisión ─────────────────────────── */

function ReviewGrid({
  items,
  answers,
  marked,
  onGo,
}: {
  items: PlayerItem[];
  answers: (string | null)[];
  marked: Set<number>;
  onGo: (i: number) => void;
}) {
  const pending = answers.filter((a) => a === null).length;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">Review your answers</h2>
        <p className="text-sm text-muted-foreground">
          {pending === 0
            ? "All questions are answered. You can still change any answer before submitting."
            : `${pending} ${pending === 1 ? "question is" : "questions are"} unanswered. Unanswered questions count as incorrect.`}
        </p>
      </div>
      <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {items.map((q, i) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => onGo(i)}
              className={cn(
                "relative flex w-full flex-col items-center rounded-xl border p-2 text-sm transition-colors hover:bg-accent",
                answers[i] !== null ? "bg-card" : "border-dashed bg-muted/40 text-muted-foreground"
              )}
              aria-label={`Question ${i + 1}: ${answers[i] !== null ? "answered" : "unanswered"}${marked.has(i) ? ", marked for review" : ""}`}
            >
              <span className="font-semibold tabular-nums">{i + 1}</span>
              <span className="text-[11px]">{SECTION_LABEL[q.section]}</span>
              {marked.has(i) && <BookmarkCheck className="absolute top-1 right-1 size-3.5 text-gold" />}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ─────────────────────────── Audio limitado ─────────────────────────── */

type LimitedAudio = ReturnType<typeof useLimitedAudio>;

/**
 * Un solo <audio> para todo el examen: sigue sonando aunque el alumno cambie de pregunta y lleva la cuenta
 * de reproducciones por asset. Sin controles nativos: no hay pausa, adelanto ni retroceso.
 */
function useLimitedAudio() {
  const ref = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [plays, setPlays] = React.useState<Record<string, number>>({});
  const [failed, setFailed] = React.useState<string | null>(null);

  React.useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    ref.current = el;
    const onTime = () => setProgress(el.duration ? el.currentTime / el.duration : 0);
    const onEnd = () => {
      setPlaying(null);
      setProgress(1);
    };
    // Teclas multimedia del sistema: si alguien pausa, sigue sonando.
    const onPause = () => {
      if (!el.ended && el.dataset.active === "1") void el.play().catch(() => undefined);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    el.addEventListener("pause", onPause);
    return () => {
      el.dataset.active = "0";
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("pause", onPause);
    };
  }, []);

  const play = React.useCallback((contextId: string, url: string) => {
    const el = ref.current;
    if (!el) return;
    setFailed(null);
    el.dataset.active = "1";
    el.src = url;
    el.currentTime = 0;
    setProgress(0);
    setPlaying(contextId);
    setPlays((p) => ({ ...p, [contextId]: (p[contextId] ?? 0) + 1 }));
    el.play().catch(() => {
      // No llegó a sonar: se devuelve la reproducción.
      el.dataset.active = "0";
      setPlaying(null);
      setFailed(contextId);
      setPlays((p) => ({ ...p, [contextId]: Math.max(0, (p[contextId] ?? 1) - 1) }));
    });
  }, []);

  const stop = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.dataset.active = "0";
    el.pause();
    setPlaying(null);
  }, []);

  return React.useMemo(() => ({ playing, progress, plays, failed, play, stop }), [playing, progress, plays, failed, play, stop]);
}

function AudioPanel({ contextId, url, maxPlays, audio }: { contextId: string; url: string; maxPlays: number; audio: LimitedAudio }) {
  const used = audio.plays[contextId] ?? 0;
  const left = Math.max(0, maxPlays - used);
  const isPlaying = audio.playing === contextId;
  const busy = audio.playing !== null;
  const value = isPlaying ? audio.progress : used > 0 ? 1 : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-3">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          className="rounded-full"
          onClick={() => audio.play(contextId, url)}
          disabled={busy || left === 0}
          aria-label={isPlaying ? "Playing" : "Play audio"}
        >
          {isPlaying ? <Headphones className="animate-pulse motion-reduce:animate-none" /> : <Play />}
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{isPlaying ? "Playing…" : left === 0 ? "Audio finished" : "Audio"}</p>
          <p className="text-xs text-muted-foreground">
            {left}/{maxPlays} {maxPlays === 1 ? "play" : "plays"} remaining
          </p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
        <div className="h-full rounded-full bg-[var(--uni-accent,var(--primary))] transition-[width] duration-200" style={{ width: `${value * 100}%` }} />
      </div>
      {audio.failed === contextId && <p className="text-xs text-destructive">The audio could not start. Tap play to try again.</p>}
      {busy && !isPlaying && <p className="text-xs text-muted-foreground">Another audio is playing.</p>}
    </div>
  );
}
