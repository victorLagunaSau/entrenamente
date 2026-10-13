"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { InstitucionIcon, useIdentidades, type Identidad } from "@/features/identidad";
import { cn } from "@/lib/utils";

const INTERVALO_MS = 2400;

/** "Rumbo a la UNAM", "Rumbo al IPN"… (Instituto / Tecnológico van con "al"). Sin prometer el ingreso. */
function meta(i: Identidad) {
  if (i.tipo === "examen_especial") return `Rumbo al ${i.sigla}`;
  const masculino = /^(instituto|tecnol[oó]gico)/i.test(i.nombre);
  return `Rumbo ${masculino ? "al" : "a la"} ${i.sigla}`;
}

function useReducedMotion() {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** Título del Hero: la meta rota entre los exámenes del catálogo (Supabase) para que se entienda para qué sirve. */
export function HeroHeadline() {
  const { identidades } = useIdentidades();
  const activas = identidades.filter((i) => i.activo);
  const metas = activas.length > 0 ? activas.map(meta) : ["Rumbo a la universidad"];
  const reduce = useReducedMotion();
  const [n, setN] = React.useState(0);

  React.useEffect(() => {
    if (reduce || metas.length < 2) return;
    const id = setInterval(() => setN((v) => v + 1), INTERVALO_MS);
    return () => clearInterval(id);
  }, [reduce, metas.length]);

  const actual = metas[n % metas.length];

  return (
    <h1 className="mt-6 text-4xl leading-[1.08] font-bold text-balance sm:text-5xl lg:text-6xl xl:text-[4.25rem]">
      <span className="sr-only">Rumbo a la universidad que quieres o a tu certificación de inglés, </span>
      <span aria-hidden className="block min-h-[1.1em]">
        {/* La animación va en un contenedor aparte: con background-clip: text el degradado parpadea como recuadro. */}
        <span key={actual} className="inline-block motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500">
          <span className="text-brand-gradient">{actual}</span>
        </span>
      </span>
      <span className="block">entrenando con su examen real.</span>
    </h1>
  );
}

/** Fila de exámenes disponibles: se entiende de un vistazo para qué es la plataforma. */
export function HeroExamStrip() {
  const { identidades } = useIdentidades();
  const activas = identidades.filter((i) => i.activo);

  return (
    <div className="mt-10 flex w-full flex-col items-center gap-3 lg:items-start">
      <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Exámenes que puedes entrenar</p>
      <ul className="flex flex-wrap justify-center gap-2 lg:justify-start">
        {activas.map((i) => (
          <li key={i.id}>
            <a
              href={i.tipo === "examen_especial" ? `#${i.id}` : "#universidades"}
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-card/60 py-1.5 pr-3 pl-1.5 text-sm font-bold transition-colors hover:border-secondary/60 hover:bg-card",
                i.tipo === "examen_especial" && "border-secondary/40"
              )}
            >
              <span
                className="grid size-7 place-items-center rounded-lg"
                style={{ background: `var(--uni-${i.id}, var(--muted))` }}
              >
                <InstitucionIcon id={i.id} label="" color={`var(--uni-${i.id}-fg, #ffffff)`} className="size-4" />
              </span>
              {i.sigla}
            </a>
          </li>
        ))}
        <li>
          <a
            href="#pisa"
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-gold/40 px-3 py-1.5 text-sm font-semibold text-gold transition-colors hover:border-gold"
          >
            <Sparkles className="size-3.5" /> PISA · Próximamente
          </a>
        </li>
      </ul>
    </div>
  );
}
