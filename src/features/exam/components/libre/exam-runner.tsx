"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Clock, Flag, Grid3x3, Hourglass, Loader2, RotateCcw, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  type ExamConfig,
  type ExamItem,
  formatClock,
  listNumbers,
  PAGE_SIZE,
  timeLimitOf,
  UNI_ACCENT,
  VIEW_MODES,
  type ViewMode,
} from "../../lib/libre";
import { shuffled } from "../../lib/shuffle";
import { type AnswerSheet, guardarExamen } from "../../services/libre-service";
import { AnswerOptions, QuestionPrompt, ReadingBlock } from "../question-parts";
import { UniBar } from "./uni-bar";

const MODE_KEY = "em.exam.viewMode";

function readMode(): ViewMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "scroll" || v === "paginado" || v === "enfoque") return v;
  } catch {}
  return "enfoque";
}

/**
 * Examen en curso. Timer general regresivo (tiempo total) + timer ascendente por pregunta
 * (se acumula en la pregunta activa: la que está a la vista en scroll/paginado, la única en "pregunta a pregunta").
 * Las respuestas se pueden cambiar hasta entregar; antes de entregar se muestra el resumen de contestadas y pendientes.
 */
export function ExamRunner({
  config,
  items,
  onFinished,
  save = guardarExamen,
}: {
  config: ExamConfig;
  items: ExamItem[];
  onFinished: (id: number) => void;
  /** Califica y congela; por defecto el Examen Libre (el plan usa guardar_examen_plan). */
  save?: (sheet: AnswerSheet) => Promise<number>;
}) {
  const total = items.length;
  const limit = React.useMemo(() => timeLimitOf(items), [items]);
  // Orden de opciones barajado una sola vez: se guarda para que el visor histórico muestre las mismas letras.
  const [orders] = React.useState(() => items.map((q) => shuffled(q.respuestas)));
  const [answers, setAnswers] = React.useState<(number | null)[]>(() => items.map(() => null));
  const [spent, setSpent] = React.useState<number[]>(() => items.map(() => 0));
  const [remaining, setRemaining] = React.useState(limit);
  const [current, setCurrent] = React.useState(0);
  const [mode, setModeState] = React.useState<ViewMode>("enfoque");
  const [scrollTo, setScrollTo] = React.useState<{ index: number; at: number } | null>(null);
  const [review, setReview] = React.useState<"mapa" | "entregar" | null>(null);
  const [saving, setSaving] = React.useState<{ timedOut: boolean; error: string | null } | null>(null);

  const currentRef = React.useRef(current);
  currentRef.current = current;
  const latest = React.useRef({ answers, spent, remaining });
  latest.current = { answers, spent, remaining };
  // Tras un salto programático, el desplazamiento suave no debe cambiar la pregunta activa.
  const lockUntil = React.useRef(0);

  React.useEffect(() => setModeState(readMode()), []);

  const jumpTo = React.useCallback((index: number) => {
    lockUntil.current = Date.now() + 900;
    setCurrent(index);
    setScrollTo({ index, at: Date.now() });
  }, []);

  const setMode = (m: ViewMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
    jumpTo(currentRef.current);
  };

  /* ── Relojes ── */
  const running = saving === null;
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
      setSpent((s) => s.map((v, i) => (i === currentRef.current ? v + 1 : v)));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const submit = React.useCallback(
    async (timedOut: boolean) => {
      setReview(null);
      setSaving({ timedOut, error: null });
      const { answers: a, spent: s, remaining: r } = latest.current;
      try {
        const id = await save({
          carreraId: config.carrera.id,
          nivel: config.nivel,
          respuestas: items.map((q, i) => ({ codigo: q.codigo, respuestaId: a[i], segundos: s[i], orden: orders[i].map((o) => o.id) })),
          tiempoLimite: limit,
          tiempoUsado: limit - r,
          agotado: timedOut,
        });
        onFinished(id);
      } catch (e) {
        setSaving({ timedOut, error: e instanceof Error ? e.message : "No pudimos guardar tu examen." });
      }
    },
    [config, items, orders, limit, onFinished, save]
  );

  // Tiempo agotado: se califica con lo respondido.
  React.useEffect(() => {
    if (remaining <= 0 && running) void submit(true);
  }, [remaining, running, submit]);

  // Evita perder el examen por recargar o cerrar la pestaña.
  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  /* ── Navegación ── */
  const page = Math.floor(current / PAGE_SIZE);
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const visible =
    mode === "enfoque" ? [current] : mode === "paginado" ? range(page * PAGE_SIZE, Math.min(total, (page + 1) * PAGE_SIZE)) : range(0, total);

  React.useEffect(() => {
    if (!scrollTo) return;
    if (mode === "enfoque") window.scrollTo({ top: 0, behavior: "smooth" });
    else document.querySelector(`[data-q="${scrollTo.index}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollTo, mode]);

  // En scroll y paginado la pregunta activa es la última cuyo inicio pasó el 40 % de la pantalla;
  // al llegar al final de la página, la última (si no, nunca se activaría y no se podría terminar).
  React.useEffect(() => {
    if (mode === "enfoque") return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < lockUntil.current) return;
      const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-q]"));
      if (cards.length === 0) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      let active = cards[0];
      if (atBottom) active = cards[cards.length - 1];
      else
        for (const card of cards) {
          if (card.getBoundingClientRect().top <= window.innerHeight * 0.4) active = card;
          else break;
        }
      setCurrent(Number(active.dataset.q));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [mode, page]);

  const pick = (index: number, id: number | null) => {
    setAnswers((a) => a.map((v, i) => (i === index ? id : v)));
    setCurrent(index);
  };

  const pending = answers.flatMap((a, i) => (a === null ? [i] : []));
  const answered = total - pending.length;
  const finish = () => setReview("entregar");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <UniBar target={config}>
          <Button size="sm" onClick={finish} className="bg-white font-bold text-black hover:bg-white/90" disabled={!running}>
            <Flag /> <span className="hidden sm:inline">Finalizar Examen</span>
            <span className="sm:hidden">Finalizar</span>
          </Button>
        </UniBar>

        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm md:px-8">
          <p className="font-semibold text-primary">
            Pregunta <span className="tabular-nums">{current + 1}</span> de {total}
            <span className="ml-2 hidden font-normal text-muted-foreground sm:inline">· {items[current].materiaNombre}</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Clock className={cn("size-4", remaining <= 60 ? "text-destructive" : remaining <= 300 ? "text-energy" : "text-muted-foreground")} />
            <span className="sr-only">Tiempo total</span>
            <span className="hidden text-xs text-muted-foreground md:inline">Tiempo total</span>
            <span
              role="timer"
              className={cn(
                "font-mono font-bold tabular-nums",
                remaining <= 60 ? "animate-pulse text-destructive motion-reduce:animate-none" : remaining <= 300 ? "text-energy" : "text-foreground"
              )}
            >
              {formatClock(remaining)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-muted-foreground" />
            <span className="sr-only">Tiempo en esta pregunta</span>
            <span className="hidden text-xs text-muted-foreground md:inline">Pregunta</span>
            <span className="font-mono font-bold text-cool tabular-nums">{formatClock(spent[current], true)}</span>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 pb-2.5 md:px-8">
          <div role="radiogroup" aria-label="Modo de vista" className="flex min-w-0 flex-1 gap-1 rounded-xl border bg-card p-1 sm:flex-none">
            {VIEW_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:flex-none",
                  mode === m.value ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="sm:hidden">{m.corto}</span>
                <span className="hidden sm:inline">{m.nombre}</span>
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="ml-auto h-9" onClick={() => setReview("mapa")} aria-label="Mapa de preguntas">
            <Grid3x3 /> <span className="tabular-nums">{answered}/{total}</span>
          </Button>
        </div>

        <div className="h-1 bg-muted" aria-hidden>
          <div className="h-full transition-[width] duration-500" style={{ width: `${(answered / total) * 100}%`, backgroundColor: UNI_ACCENT }} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 md:p-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        {mode === "paginado" && (
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Página {page + 1} de {pageCount}
          </p>
        )}
        {visible.map((i, k) => {
          const showMateria = mode !== "enfoque" && (k === 0 || items[visible[k - 1]].materia !== items[i].materia);
          return (
            <React.Fragment key={items[i].codigo}>
              {showMateria && (
                <h2 className="mt-2 flex items-center gap-2 font-display text-lg font-bold">
                  <span className="h-5 w-1 rounded-full" style={{ backgroundColor: UNI_ACCENT }} /> {items[i].materiaNombre}
                </h2>
              )}
              <QuestionCard
                index={i}
                total={total}
                item={items[i]}
                options={orders[i]}
                picked={answers[i]}
                active={mode !== "enfoque" && i === current}
                disabled={!running}
                onPick={(id) => pick(i, id)}
              />
            </React.Fragment>
          );
        })}

        <BottomNav
          mode={mode}
          atStart={mode === "paginado" ? page === 0 : current === 0}
          atEnd={mode === "paginado" ? page >= pageCount - 1 : current >= total - 1}
          disabled={!running}
          onPrev={() => jumpTo(mode === "paginado" ? (page - 1) * PAGE_SIZE : current - 1)}
          onNext={() => jumpTo(mode === "paginado" ? (page + 1) * PAGE_SIZE : current + 1)}
          onFinish={finish}
        />
      </main>

      <ReviewDialog
        kind={review}
        onClose={() => setReview(null)}
        items={items}
        answers={answers}
        current={current}
        pending={pending}
        onJump={(i) => {
          setReview(null);
          jumpTo(i);
        }}
        onSubmit={() => void submit(false)}
      />

      {saving && <SavingOverlay timedOut={saving.timedOut} error={saving.error} onRetry={() => void submit(saving.timedOut)} />}
    </div>
  );
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, k) => from + k);

/** Scroll continuo: todo está a la vista, así que al final solo se ofrece finalizar. */
function BottomNav({
  mode,
  atStart,
  atEnd,
  disabled,
  onPrev,
  onNext,
  onFinish,
}: {
  mode: ViewMode;
  atStart: boolean;
  atEnd: boolean;
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const finishButton = (
    <Button onClick={onFinish} disabled={disabled}>
      <Flag /> Finalizar Examen
    </Button>
  );
  if (mode === "scroll") return <nav className="mt-2 flex justify-center">{finishButton}</nav>;
  return (
    <nav className="flex items-center justify-between gap-2" aria-label="Navegación del examen">
      <Button variant="outline" onClick={onPrev} disabled={atStart || disabled}>
        <ArrowLeft /> Anterior
      </Button>
      {atEnd ? (
        finishButton
      ) : (
        <Button onClick={onNext} disabled={disabled}>
          Siguiente <ArrowRight />
        </Button>
      )}
    </nav>
  );
}

function QuestionCard({
  index,
  total,
  item,
  options,
  picked,
  active,
  disabled,
  onPick,
}: {
  index: number;
  total: number;
  item: ExamItem;
  options: { id: number; texto: string }[];
  picked: number | null;
  active: boolean;
  disabled: boolean;
  onPick: (id: number | null) => void;
}) {
  return (
    <article
      data-q={index}
      aria-label={`Pregunta ${index + 1} de ${total}`}
      className={cn("scroll-mt-52 rounded-3xl border bg-card p-4 shadow-sm transition-colors sm:p-6", active && "border-foreground/40")}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Pregunta {index + 1} de {total} · {item.materiaNombre}
        </p>
        {picked !== null ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-foreground">
            <CheckCircle2 className="size-3.5" /> Respondida
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">Pendiente</span>
        )}
      </div>
      {item.lectura && <ReadingBlock text={item.lectura} className="mt-4" />}
      <QuestionPrompt text={item.pregunta} className="mt-4" />
      <AnswerOptions className="mt-4" options={options} picked={picked} onPick={onPick} disabled={disabled} />
      {picked !== null && !disabled && (
        <button type="button" onClick={() => onPick(null)} className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Borrar respuesta
        </button>
      )}
    </article>
  );
}

/**
 * Resumen de contestadas y pendientes. Como "mapa" solo navega; como "entregar" es el paso obligatorio
 * antes de calificar: si falta alguna, se puede ir directo a ella.
 */
function ReviewDialog({
  kind,
  onClose,
  items,
  answers,
  current,
  pending,
  onJump,
  onSubmit,
}: {
  kind: "mapa" | "entregar" | null;
  onClose: () => void;
  items: ExamItem[];
  answers: (number | null)[];
  current: number;
  pending: number[];
  onJump: (index: number) => void;
  onSubmit: () => void;
}) {
  // Bloques consecutivos por materia (el examen viene agrupado).
  const groups: { materia: string; indices: number[] }[] = [];
  items.forEach((q, i) => {
    const last = groups[groups.length - 1];
    if (last?.materia === q.materiaNombre) last.indices.push(i);
    else groups.push({ materia: q.materiaNombre, indices: [i] });
  });
  const answered = items.length - pending.length;
  const entregar = kind === "entregar";

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entregar ? "Resumen antes de entregar" : "Mapa del examen"}</DialogTitle>
          <DialogDescription>
            {answered} contestadas · {pending.length} pendientes. Toca un número para ir a esa pregunta.
          </DialogDescription>
        </DialogHeader>

        {entregar && pending.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Atención: tienes {pending.length} {pending.length === 1 ? "pregunta pendiente" : "preguntas pendientes"} por responder (
              {listNumbers(pending.map((i) => i + 1))}). ¿Deseas finalizar de todos modos o regresar a completarlas?
            </span>
          </p>
        )}

        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.materia + g.indices[0]} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{g.materia}</h3>
              <ul className="flex flex-wrap gap-2">
                {g.indices.map((i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onJump(i)}
                      aria-current={i === current}
                      aria-label={`Pregunta ${i + 1}${answers[i] === null ? ", pendiente" : ", contestada"}`}
                      className={cn(
                        "grid size-9 place-items-center rounded-lg border font-mono text-sm font-bold transition-colors",
                        answers[i] !== null
                          ? "border-secondary bg-secondary text-secondary-foreground"
                          : "border-dashed border-gold bg-gold/10 text-gold hover:bg-gold/20",
                        i === current && "ring-2 ring-ring ring-offset-2 ring-offset-card"
                      )}
                    >
                      {i + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-secondary" /> Contestada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-dashed border-gold bg-gold/10" /> Pendiente
          </span>
        </p>

        {entregar && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {pending.length > 0 ? (
              <>
                <Button variant="outline" onClick={onSubmit}>
                  Finalizar de todos modos
                </Button>
                <Button onClick={() => onJump(pending[0])}>Regresar a completarlas</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>
                  Seguir revisando
                </Button>
                <Button onClick={onSubmit}>
                  <Flag /> Entregar y calificar
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SavingOverlay({ timedOut, error, onRetry }: { timedOut: boolean; error: string | null; onRetry: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-surface-deep/85 p-4 backdrop-blur-sm" role="alertdialog" aria-live="assertive">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center">
        {timedOut && (
          <p className="flex items-center gap-2 font-display text-lg font-bold text-energy">
            <Hourglass className="size-5" /> Tiempo agotado
          </p>
        )}
        {error ? (
          <>
            <p className="flex items-start gap-2 text-left text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
            <p className="text-xs text-muted-foreground">Tus respuestas siguen aquí. Revisa tu conexión y vuelve a intentarlo.</p>
            <Button onClick={onRetry}>
              <RotateCcw /> Reintentar
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="size-7 animate-spin text-muted-foreground motion-reduce:animate-none" />
            <p className="text-sm text-cool">Calificando y guardando tu examen…</p>
          </>
        )}
      </div>
    </div>
  );
}
