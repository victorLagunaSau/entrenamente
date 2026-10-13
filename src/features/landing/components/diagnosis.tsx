import { BookOpen, Check, Snowflake, X, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

/** Guía estática en grises: renglones planos, todos iguales. */
function StaticGuide() {
  return (
    <div aria-hidden className="relative h-44 rounded-2xl border border-white/5 bg-[#101b2e] p-5 grayscale">
      <div className="flex items-center gap-2 text-slate-500">
        <BookOpen className="size-4" />
        <span className="h-2 w-24 rounded bg-slate-600/60" />
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        {[92, 88, 95, 80, 90].map((w, i) => (
          <span key={i} className="h-2 rounded bg-slate-700/70" style={{ width: `${w}%` }} />
        ))}
      </div>
      <Snowflake className="absolute right-5 bottom-5 size-8 text-slate-500/70" />
    </div>
  );
}

/** Tarjetas de reactivos que se reacomodan y cambian de dificultad. */
function DynamicDeck() {
  const cards = [
    { label: "Fácil", tone: "border-secondary/50 text-secondary", rot: "-rotate-6 -translate-x-10" },
    { label: "Media", tone: "border-brand-light/50 text-brand-light", rot: "rotate-3 translate-x-8 -translate-y-2" },
    { label: "Difícil", tone: "border-energy/70 text-energy shadow-glow-energy", rot: "-rotate-1 translate-y-3" },
  ];
  return (
    <div aria-hidden className="relative grid h-44 place-items-center overflow-hidden rounded-2xl border border-energy/20 bg-surface-deep">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgb(255_94_26/0.22),transparent_65%)]" />
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            "absolute w-44 rounded-xl border bg-card/95 p-3 transition-transform duration-500 group-hover:rotate-0",
            c.tone,
            c.rot
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase">
            {c.label}
            <Zap className="size-3.5" />
          </div>
          <span className="mt-2 block h-1.5 w-full rounded bg-white/15" />
          <span className="mt-1.5 block h-1.5 w-2/3 rounded bg-white/15" />
        </div>
      ))}
    </div>
  );
}

const GUIA = [
  "Te entrega teoría plana y un solo ejemplo por tema.",
  "Crea una falsa ilusión de dominio: “entendí el libro, pero me congelé en la prueba”.",
  "No entrena el manejo del tiempo ni la presión del día del examen.",
];

const ESTADO_EXAMEN = [
  { title: "Práctica de evocación", body: "Recuperas lo aprendido resolviendo reactivos contra reloj, en lugar de releerlo." },
  { title: "Variantes del reactivo", body: "Enfrentas el mismo concepto redactado de formas distintas: entiendes la lógica, no memorizas la respuesta." },
  { title: "Inoculación del estrés", body: "Tu velocidad de respuesta se vuelve automática; el día del examen oficial te sientes en casa." },
];

export function Diagnosis() {
  return (
    <section aria-labelledby="diagnostico" className="reveal mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading
        id="diagnostico"
        eyebrow="El problema"
        title={
          <>
            ¿Sales mal en los exámenes <span className="text-brand-gradient">aunque te sabes las respuestas?</span>
          </>
        }
        subtitle="No es tu capacidad. Estudiaste en modo lectura y el examen se presenta en Estado Examen: con reloj, presión y preguntas que no se parecen a las de tu guía."
      />

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        <article className="flex flex-col gap-6 rounded-3xl border bg-card/50 p-6 sm:p-8">
          <StaticGuide />
          <div>
            <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Aprendizaje pasivo</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-300">La guía tradicional</h3>
            <ul className="mt-5 flex flex-col gap-3">
              {GUIA.map((g) => (
                <li key={g} className="flex gap-3 text-muted-foreground">
                  <X className="mt-0.5 size-5 shrink-0 text-slate-500" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="group relative flex flex-col gap-6 rounded-3xl border border-energy/30 bg-card p-6 shadow-[0_0_60px_-20px_rgb(255_94_26/0.45)] sm:p-8">
          <DynamicDeck />
          <div>
            <p className="text-xs font-semibold tracking-widest text-energy uppercase">Entrenamiento activo</p>
            <h3 className="mt-2 text-2xl font-semibold">Estado Examen de EntrenaMente</h3>
            <ul className="mt-5 flex flex-col gap-3">
              {ESTADO_EXAMEN.map((e) => (
                <li key={e.title} className="flex gap-3 text-muted-foreground">
                  <Check className="mt-0.5 size-5 shrink-0 text-secondary" />
                  <span>
                    <strong className="font-semibold text-cool">{e.title}:</strong> {e.body}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}
