"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronsUp, CircleAlert, Flag, Loader2, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { Dificultad } from "../../types";
import { type ExamItem, type ExamTarget, formatClock, timeLimitOf } from "../../lib/libre";
import { shuffled } from "../../lib/shuffle";
import { guardarRacha, type RachaGame } from "../../services/racha-service";
import { MathText } from "../math-text";
import { ReadingBlock } from "../question-parts";
import { buzz, PhoneFrame } from "./racha-parts";

/** Color de cada letra, como botones de un juego de trivia. */
const LETTERS = [
  { badge: "bg-primary text-primary-foreground", picked: "border-primary bg-primary/20" },
  { badge: "bg-secondary text-secondary-foreground", picked: "border-secondary bg-secondary/20" },
  { badge: "bg-gold text-background", picked: "border-gold bg-gold/20" },
  { badge: "bg-energy text-background", picked: "border-energy bg-energy/20" },
  { badge: "bg-brand-light text-background", picked: "border-brand-light bg-brand-light/20" },
];

const DIFICULTAD_PASO: Record<Dificultad, number> = { facil: 1, media: 2, dificil: 3 };

/**
 * Partida en curso: una pregunta por pantalla y se desliza hacia arriba (tipo TikTok). La respuesta se fija al tocarla
 * y pasa sola a la siguiente; deslizar sin responder la salta. La última pantalla es para entregar.
 * El reloj es uno solo (mismo tiempo total que el Examen Libre) y se vuelve más dramático conforme se acaba.
 */
export function RachaRunner({ target, game, onFinished }: { target: ExamTarget; game: RachaGame; onFinished: (id: number) => void }) {
  const { items, nivel } = game;
  const total = items.length;
  const limit = React.useMemo(() => timeLimitOf(items), [items]);
  // Orden de opciones barajado una sola vez: se guarda para que el visor histórico muestre las mismas letras.
  const [orders] = React.useState(() => items.map((q) => shuffled(q.respuestas)));
  const [answers, setAnswers] = React.useState<(number | null)[]>(() => items.map(() => null));
  const [current, setCurrent] = React.useState(0);
  const [saving, setSaving] = React.useState<{ timedOut: boolean; error: string | null } | null>(null);
  const [leaving, setLeaving] = React.useState(false);
  const [startedAt] = React.useState(() => Date.now());

  const feedRef = React.useRef<HTMLDivElement>(null);
  const currentRef = React.useRef(0);
  const enteredAt = React.useRef(startedAt);
  const spentMs = React.useRef(items.map(() => 0));
  const answersRef = React.useRef(answers);
  answersRef.current = answers;
  // Tiempos congelados al entregar (un reintento de guardado no debe sumar la espera).
  const final = React.useRef<{ segundos: number[]; usado: number } | null>(null);

  const running = saving === null;

  /* ── Pantalla activa y tiempo por pregunta ── */
  const enter = React.useCallback(
    (index: number) => {
      const now = Date.now();
      const prev = currentRef.current;
      if (prev < total) spentMs.current[prev] += now - enteredAt.current;
      enteredAt.current = now;
      currentRef.current = index;
      setCurrent(index);
    },
    [total]
  );

  // La pantalla activa es la que cruza la línea media del feed.
  React.useEffect(() => {
    const root = feedRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.slide);
          if (e.isIntersecting && i !== currentRef.current) enter(i);
        }
      },
      { root, rootMargin: "-50% 0px -50% 0px", threshold: 0 }
    );
    root.querySelectorAll("[data-slide]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [enter]);

  const goTo = React.useCallback((index: number) => {
    feedRef.current?.querySelector(`[data-slide="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Flechas del teclado en la web.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        goTo(Math.min(total, Math.max(0, currentRef.current + (e.key === "ArrowDown" ? 1 : -1))));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, total]);

  const pick = (index: number, id: number) => {
    if (!running || answersRef.current[index] !== null) return;
    const next = answersRef.current.map((v, i) => (i === index ? id : v));
    setAnswers(next);
    buzz(15);
    // Siguiente pendiente después de esta; si no hay, la pantalla de entrega.
    const after = next.findIndex((v, i) => i > index && v === null);
    setTimeout(() => goTo(after === -1 ? total : after), 550);
  };

  /* ── Entrega ── */
  const submit = React.useCallback(
    async (timedOut: boolean) => {
      setLeaving(false);
      setSaving({ timedOut, error: null });
      if (!final.current) {
        const now = Date.now();
        if (currentRef.current < total) spentMs.current[currentRef.current] += now - enteredAt.current;
        enteredAt.current = now;
        final.current = {
          segundos: spentMs.current.map((ms) => ms / 1000),
          usado: timedOut ? limit : Math.min(limit, (now - startedAt) / 1000),
        };
      }
      const { segundos, usado } = final.current;
      try {
        const id = await guardarRacha({
          carreraId: target.carrera.id,
          nivel,
          respuestas: items.map((q, i) => ({ codigo: q.codigo, respuestaId: answersRef.current[i], segundos: segundos[i], orden: orders[i].map((o) => o.id) })),
          tiempoLimite: limit,
          tiempoUsado: usado,
          agotado: timedOut,
        });
        onFinished(id);
      } catch (e) {
        setSaving({ timedOut, error: e instanceof Error ? e.message : "No pudimos guardar tu racha." });
      }
    },
    [target, nivel, items, orders, limit, startedAt, total, onFinished]
  );

  const onExpire = React.useCallback(() => void submit(true), [submit]);

  // Evita perder la partida por recargar o cerrar la pestaña.
  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const pending = answers.flatMap((a, i) => (a === null ? [i] : []));
  const answered = total - pending.length;

  return (
    <PhoneFrame>
      <div className="relative flex h-dvh flex-col">
        <BombTimer
          limit={limit}
          startedAt={startedAt}
          stopped={!running}
          onExpire={onExpire}
          left={
            <button
              type="button"
              onClick={() => setLeaving(true)}
              aria-label="Abandonar partida"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-card/80 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          }
          right={
            <span className="grid h-10 min-w-10 shrink-0 place-items-center rounded-full bg-card/80 px-3 font-mono text-sm font-bold tabular-nums">
              {answered}/{total}
            </span>
          }
        >
          <ol className="mt-2 flex gap-0.5" aria-hidden>
            {items.map((q, i) => (
              <li
                key={q.codigo}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i === current ? "bg-energy" : answers[i] !== null ? "bg-foreground/70" : "bg-muted"
                )}
              />
            ))}
          </ol>
        </BombTimer>

        <div ref={feedRef} className="relative z-0 min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-none">
          {items.map((q, i) => (
            <QuestionSlide
              key={q.codigo}
              index={i}
              total={total}
              item={q}
              options={orders[i]}
              picked={answers[i]}
              disabled={!running}
              hint={i === 0 && answers[0] === null}
              onPick={(id) => pick(i, id)}
            />
          ))}
          <section data-slide={total} className="flex min-h-full snap-start snap-always flex-col items-center justify-center gap-5 px-6 py-10 text-center">
            <span className="grid size-20 place-items-center rounded-full bg-energy/15 text-energy animate-pulse-glow">
              <Flag className="size-9" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-3xl font-black uppercase italic">{pending.length === 0 ? "¡Completa!" : "¡Casi!"}</h2>
              <p className="text-sm text-muted-foreground">
                {answered} de {total} respondidas
              </p>
            </div>
            {pending.length > 0 && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs font-semibold tracking-widest text-gold uppercase">Te faltan</p>
                <ul className="flex flex-wrap justify-center gap-2">
                  {pending.map((i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        aria-label={`Ir a la pregunta ${i + 1}`}
                        className="grid size-10 place-items-center rounded-xl border border-dashed border-gold bg-gold/10 font-mono text-sm font-bold text-gold"
                      >
                        {i + 1}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Las que no respondas cuentan como falladas.</p>
              </div>
            )}
            <Button
              variant="energy"
              disabled={!running}
              onClick={() => {
                buzz([30, 30, 60]);
                void submit(false);
              }}
              className="h-16 w-full max-w-xs rounded-2xl font-display text-xl font-black tracking-wide uppercase italic"
            >
              Entregar
            </Button>
          </section>
        </div>

        {saving && <SavingOverlay timedOut={saving.timedOut} error={saving.error} onRetry={() => void submit(saving.timedOut)} />}
      </div>

      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Abandonar la partida?</DialogTitle>
            <DialogDescription>Si sales ahora, esta racha no se guarda y no cuenta para tu día.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="energy" onClick={() => setLeaving(false)}>
              Seguir jugando
            </Button>
            <Button asChild variant="ghost">
              <Link href="/app/student">Salir</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PhoneFrame>
  );
}

/* ─────────────────────────── Reloj ─────────────────────────── */

type Phase = "calma" | "alerta" | "peligro" | "critico";

const PHASE_TONE: Record<Phase, { text: string; bar: string }> = {
  calma: { text: "text-secondary", bar: "bg-secondary" },
  alerta: { text: "text-gold", bar: "bg-gold" },
  peligro: { text: "text-energy", bar: "bg-energy" },
  critico: { text: "text-destructive", bar: "bg-destructive" },
};

function phaseOf(ms: number, limitMs: number): Phase {
  const r = ms / limitMs;
  if (ms <= 10_000 || r <= 0.1) return "critico";
  if (r <= 0.25) return "peligro";
  if (r <= 0.5) return "alerta";
  return "calma";
}

/**
 * Reloj regresivo con mecha: cambia de color por fases, late en peligro, tiembla y marca décimas en los últimos segundos,
 * con viñeta roja y vibración cada segundo. Solo este componente se redibuja con el reloj.
 */
function BombTimer({
  limit,
  startedAt,
  stopped,
  onExpire,
  left,
  right,
  children,
}: {
  limit: number;
  startedAt: number;
  stopped: boolean;
  onExpire: () => void;
  left: React.ReactNode;
  right: React.ReactNode;
  children: React.ReactNode;
}) {
  const limitMs = limit * 1000;
  // Décimas restantes: solo se redibuja cuando cambia lo que se ve.
  const [tenths, setTenths] = React.useState(limit * 10);
  const expired = React.useRef(false);
  const onExpireRef = React.useRef(onExpire);
  onExpireRef.current = onExpire;

  React.useEffect(() => {
    if (stopped) return;
    let frame = 0;
    const tick = () => {
      const left = Math.max(0, limitMs - (Date.now() - startedAt));
      // Fuera de los últimos 10 s basta con el segundo (mismo valor = React no redibuja).
      setTenths(left <= 10_000 ? Math.ceil(left / 100) : Math.ceil(left / 1000) * 10);
      if (left <= 0) {
        if (!expired.current) {
          expired.current = true;
          onExpireRef.current();
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [limitMs, startedAt, stopped]);

  const ms = tenths * 100;
  const phase = phaseOf(ms, limitMs);
  const tone = PHASE_TONE[phase];
  const seconds = Math.ceil(ms / 1000);

  // Vibración: aviso al entrar en peligro y un golpe por segundo en lo crítico.
  const lastPhase = React.useRef(phase);
  React.useEffect(() => {
    if (phase === "peligro" && lastPhase.current !== "peligro") buzz([80, 60, 80]);
    lastPhase.current = phase;
  }, [phase]);
  React.useEffect(() => {
    if (phase === "critico" && !stopped && seconds > 0) buzz(25);
  }, [seconds, phase, stopped]);

  const clock = phase === "critico" ? `${String(Math.floor(ms / 1000)).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}` : formatClock(seconds, true);

  return (
    <>
      {(phase === "peligro" || phase === "critico") && (
        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-0 z-30", phase === "critico" && "animate-racha-vignette")}
          style={{
            boxShadow: phase === "critico" ? "inset 0 0 90px 10px rgb(239 68 68 / 0.55)" : "inset 0 0 70px 0 rgb(255 94 26 / 0.25)",
          }}
        />
      )}
      <header className="relative z-20 bg-background/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="flex items-center gap-3">
          {left}
          <div className="flex flex-1 justify-center">
            <span
              role="timer"
              aria-label={`Tiempo restante ${formatClock(seconds)}`}
              className={cn(
                "inline-block font-mono text-4xl font-black tabular-nums transition-colors",
                tone.text,
                phase === "peligro" && "animate-racha-heartbeat",
                phase === "critico" && "text-5xl animate-racha-shake"
              )}
              style={phase === "critico" ? { textShadow: "0 0 24px rgb(239 68 68 / 0.8)" } : undefined}
            >
              {clock}
            </span>
          </div>
          {right}
        </div>

        {/* Mecha: se consume con el tiempo y la chispa va en la punta. */}
        <div className="relative mt-3 h-2 rounded-full bg-muted" aria-hidden>
          <div className={cn("relative h-full rounded-full transition-[width] duration-100 ease-linear", tone.bar)} style={{ width: `${(ms / limitMs) * 100}%` }}>
            {!stopped && ms > 0 && (
              <span
                className="absolute top-1/2 right-0 size-3.5 rounded-full bg-gold animate-racha-spark"
                style={{ transform: "translate(50%, -50%)", boxShadow: "0 0 12px 3px rgb(255 209 102 / 0.9), 0 0 24px 6px rgb(255 94 26 / 0.6)" }}
              />
            )}
          </div>
        </div>
        {children}
      </header>
    </>
  );
}

/* ─────────────────────────── Pregunta ─────────────────────────── */

function QuestionSlide({
  index,
  total,
  item,
  options,
  picked,
  disabled,
  hint,
  onPick,
}: {
  index: number;
  total: number;
  item: ExamItem;
  options: { id: number; texto: string }[];
  picked: number | null;
  disabled: boolean;
  hint: boolean;
  onPick: (id: number) => void;
}) {
  const locked = picked !== null;
  return (
    <section
      data-slide={index}
      aria-label={`Pregunta ${index + 1} de ${total}`}
      className="flex min-h-full snap-start snap-always flex-col justify-center gap-4 px-5 py-6"
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate rounded-full bg-card px-3 py-1 text-xs font-bold">{item.materiaNombre}</span>
        <span className="flex gap-0.5" aria-label={`Dificultad ${DIFICULTAD_PASO[item.dificultad]} de 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={cn("size-1.5 rounded-full", n <= DIFICULTAD_PASO[item.dificultad] ? "bg-energy" : "bg-muted")} />
          ))}
        </span>
        <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {index + 1}/{total}
        </span>
      </div>

      {item.lectura && <ReadingBlock text={item.lectura} className="bg-card/60" />}

      <MathText text={item.pregunta} className="block font-display text-xl leading-snug font-bold text-balance sm:text-2xl" />

      <ul className="flex flex-col gap-2.5">
        {options.map((o, k) => {
          const letter = LETTERS[k % LETTERS.length];
          const isPicked = picked === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={disabled || locked}
                onClick={() => onPick(o.id)}
                aria-pressed={isPicked}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-card px-3 py-3 text-left text-base font-semibold transition-all outline-none active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  !locked && "border-transparent hover:border-foreground/20",
                  isPicked && cn(letter.picked, "animate-racha-pop"),
                  locked && !isPicked && "border-transparent opacity-35"
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl font-display text-base font-black", letter.badge)}>
                  {isPicked ? <Check className="size-5" /> : String.fromCharCode(65 + k)}
                </span>
                <MathText text={o.texto} className="min-w-0 text-foreground" />
              </button>
            </li>
          );
        })}
      </ul>

      <p className={cn("flex h-5 items-center justify-center gap-1 text-xs text-muted-foreground", !hint && !locked && "invisible")}>
        {locked ? (
          <>
            <Check className="size-3.5 text-secondary" /> Fijada
          </>
        ) : (
          <>
            <ChevronsUp className="size-4 animate-bounce motion-reduce:animate-none" /> Desliza para saltar
          </>
        )}
      </p>
    </section>
  );
}

/* ─────────────────────────── Guardado ─────────────────────────── */

function SavingOverlay({ timedOut, error, onRetry }: { timedOut: boolean; error: string | null; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-surface-deep/90 p-6 backdrop-blur-sm" role="alertdialog" aria-live="assertive">
      <div className="flex w-full flex-col items-center gap-4 text-center">
        {timedOut && (
          <p className="font-display text-6xl font-black text-destructive uppercase italic animate-in fade-in-0 zoom-in-150 duration-300 motion-reduce:animate-none">
            ¡Tiempo!
          </p>
        )}
        {error ? (
          <>
            <p className="flex items-start gap-2 text-left text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
            <p className="text-xs text-muted-foreground">Tus respuestas siguen aquí. Revisa tu conexión y vuelve a intentarlo.</p>
            <Button variant="energy" onClick={onRetry}>
              <RotateCcw /> Reintentar
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="size-8 animate-spin text-energy motion-reduce:animate-none" />
            <p className="font-display text-lg font-bold">Contando tus puntos…</p>
          </>
        )}
      </div>
    </div>
  );
}
