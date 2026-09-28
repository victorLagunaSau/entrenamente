"use client";

import * as React from "react";
import { ChevronsUp, Lightbulb, Sparkles, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SnapshotQuestion } from "../../lib/libre";
import { MathText } from "../math-text";
import { orderedOptions } from "../libre/report-print";

/** Fondo de cada tarjeta: rota entre los acentos de la marca para que cada una se sienta distinta. */
const GLOWS = ["rgb(30 111 230 / 0.35)", "rgb(18 194 169 / 0.3)", "rgb(255 209 102 / 0.25)", "rgb(255 94 26 / 0.3)"];

/**
 * Guía de estudio de la racha como "datos curiosos": una tarjeta por pregunta fallada, a pantalla completa,
 * que se desliza hacia arriba. Mismo contenido que la guía del Examen Libre (respuesta, diagnóstico y solución),
 * contado en corto.
 */
export function RachaFacts({ questions, onClose }: { questions: SnapshotQuestion[]; onClose: () => void }) {
  const [current, setCurrent] = React.useState(0);
  const feedRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const root = feedRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.card));
      },
      { root, rootMargin: "-50% 0px -50% 0px", threshold: 0 }
    );
    root.querySelectorAll("[data-card]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Sin scroll del fondo mientras está abierto; Escape cierra.
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-surface-deep" role="dialog" aria-modal="true" aria-label="Datos curiosos">
      <div className="relative mx-auto h-dvh w-full max-w-md bg-background md:border-x">
        <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full bg-card/80 text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
          <ol className="flex flex-1 gap-1" aria-hidden>
            {questions.map((q, i) => (
              <li key={q.id_original} className={cn("h-1 flex-1 rounded-full", i <= current ? "bg-gold" : "bg-muted")} />
            ))}
          </ol>
          <span className="font-mono text-xs font-bold tabular-nums">
            {Math.min(current + 1, questions.length)}/{questions.length}
          </span>
        </header>

        <div ref={feedRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-none">
          {questions.map((q, i) => (
            <FactCard key={q.id_original} q={q} index={i} last={i === questions.length - 1} onClose={onClose} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FactCard({ q, index, last, onClose }: { q: SnapshotQuestion; index: number; last: boolean; onClose: () => void }) {
  const [open, setOpen] = React.useState(false);
  const options = orderedOptions(q);
  const correct = options.find((r) => r.ponderacion === 1);
  const unanswered = q.respuesta_seleccionada_id === null;

  return (
    <section
      data-card={index}
      className="relative flex min-h-full snap-start snap-always flex-col justify-center gap-5 px-6 pt-20 pb-10"
      style={{ background: `radial-gradient(80% 50% at 50% 30%, ${GLOWS[index % GLOWS.length]}, transparent 75%)` }}
    >
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-black tracking-widest text-gold uppercase">
          <Sparkles className="size-4" /> ¿Sabías que…?
        </span>
        <span className="ml-auto min-w-0 truncate rounded-full bg-card/80 px-3 py-1 text-xs font-bold">{q.materia}</span>
      </div>

      <button type="button" onClick={() => setOpen((o) => !o)} className="text-left" aria-expanded={open}>
        <MathText text={q.pregunta} className={cn("block text-sm text-muted-foreground", !open && "line-clamp-4")} />
        {!open && <span className="mt-1 block text-xs font-semibold text-foreground/70">Ver pregunta completa</span>}
      </button>

      {correct && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-widest text-secondary uppercase">La respuesta es</p>
          <MathText text={correct.texto} className="block font-display text-3xl leading-tight font-black text-balance" />
        </div>
      )}

      {(q.diagnostico_error || unanswered) && (
        <div className="flex gap-3 rounded-2xl bg-card/70 p-4">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-energy" />
          <div className="min-w-0 text-sm">
            <p className="font-bold">{unanswered ? "Esta se te pasó" : "Por qué caíste"}</p>
            {q.diagnostico_error ? (
              <MathText text={q.diagnostico_error} className="text-muted-foreground" />
            ) : (
              <p className="text-muted-foreground">No alcanzaste a responderla. La próxima es tuya.</p>
            )}
          </div>
        </div>
      )}

      {q.solucion_paso_a_paso.length > 0 && (
        <div className="flex gap-3 rounded-2xl bg-card/70 p-4">
          <Wand2 className="mt-0.5 size-5 shrink-0 text-brand-light" />
          <div className="min-w-0 text-sm">
            <p className="font-bold">El truco</p>
            <ol className="mt-1 flex flex-col gap-1.5">
              {q.solucion_paso_a_paso.map((paso, k) => (
                <li key={k} className="flex gap-2">
                  <span className="font-mono text-xs font-bold text-brand-light">{k + 1}</span>
                  <MathText text={paso} className="min-w-0 text-muted-foreground" />
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {last ? (
        <Button variant="energy" onClick={onClose} className="h-14 rounded-2xl font-display text-lg font-black uppercase italic">
          ¡Ya lo sé!
        </Button>
      ) : (
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <ChevronsUp className="size-4 animate-bounce motion-reduce:animate-none" /> Desliza para el siguiente
        </p>
      )}
    </section>
  );
}
