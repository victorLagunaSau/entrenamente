import { Brain, HeartPulse, Shuffle } from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

/** Comparativa de un estudio: dos barras (pasivo contra Estado Examen). */
function Bars({ pasivo, activo }: { pasivo: { label: string; value: number }; activo: { label: string; value: number } }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-background/60 p-4">
      {[
        { ...pasivo, bar: "bg-slate-600", text: "text-slate-300" },
        { ...activo, bar: "bg-brand-gradient", text: "text-secondary" },
      ].map((b) => (
        <div key={b.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{b.label}</span>
            <span className={cn("font-display text-xl font-bold tabular-nums", b.text)}>{b.value} %</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", b.bar)} style={{ width: `${b.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const PRINCIPIOS = [
  {
    icon: Brain,
    title: "Efecto de práctica activa",
    body: "Releer y subrayar se siente productivo, pero se olvida rápido. Recuperar la información respondiendo exámenes obliga al cerebro a consolidarla.",
    visual: (
      <Bars pasivo={{ label: "Solo releyeron", value: 40 }} activo={{ label: "Practicaron con exámenes", value: 61 }} />
    ),
    nota: "Recuerdo una semana después.",
    fuente: "Roediger y Karpicke (2006), Psychological Science.",
    enApp: "Cada examen de EntrenaMente es práctica de evocación.",
  },
  {
    icon: HeartPulse,
    title: "Memoria a prueba de estrés",
    body: "Bajo estrés, quien solo releyó recuerda menos. Quien estudió practicando con exámenes conserva su recuerdo aun bajo presión.",
    visual: (
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-background/60 p-4 text-center text-xs">
        <div className="rounded-xl border border-slate-600/50 p-3">
          <p className="text-muted-foreground">Solo releyeron</p>
          <p className="mt-1 font-display text-base font-bold text-slate-300">Recuerdan menos</p>
        </div>
        <div className="rounded-xl border border-secondary/50 bg-secondary/10 p-3">
          <p className="text-muted-foreground">Practicaron con exámenes</p>
          <p className="mt-1 font-display text-base font-bold text-secondary">Recuerdan igual</p>
        </div>
      </div>
    ),
    nota: "Recuerdo bajo estrés agudo.",
    fuente: "Smith, Floerke y Thomas (2016), Science.",
    enApp: "Por eso entrenas con el reloj y el diseño del examen real de tu universidad.",
  },
  {
    icon: Shuffle,
    title: "Práctica intercalada",
    body: "Resolver un solo tipo de ejercicio en bloque te enseña a repetir un procedimiento. Mezclar temas te obliga a reconocer qué estrategia usar.",
    visual: (
      <Bars pasivo={{ label: "Practicaron en bloque", value: 20 }} activo={{ label: "Practicaron intercalado", value: 63 }} />
    ),
    nota: "Aciertos en la prueba final.",
    fuente: "Rohrer y Taylor (2007), Instructional Science.",
    enApp: "La Racha intercala todas tus materias y los reactivos tienen variantes.",
  },
];

export function Science() {
  return (
    <section aria-labelledby="ciencia" className="relative isolate border-y bg-surface-deep/60 py-20 sm:py-28">
      <div className="reveal mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="ciencia"
          eyebrow="La ciencia detrás"
          title={
            <>
              Por qué funciona el <span className="text-brand-gradient">Estado Examen</span>
            </>
          }
          subtitle="La psicología cognitiva coincide: practicar con exámenes es de las técnicas de estudio más eficaces, y releer o subrayar de las menos (Dunlosky et al., 2013)."
        />

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PRINCIPIOS.map(({ icon: Icon, ...p }) => (
            <article key={p.title} className="flex flex-col gap-5 rounded-3xl border bg-card/70 p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary">
                  <Icon className="size-5" />
                </span>
                <h3 className="text-xl font-semibold">{p.title}</h3>
              </div>
              <p className="text-muted-foreground">{p.body}</p>
              <div className="mt-auto flex flex-col gap-2">
                {p.visual}
                <p className="text-xs text-muted-foreground">
                  {p.nota} <cite className="not-italic">{p.fuente}</cite>
                </p>
              </div>
              <p className="border-t pt-4 text-sm font-medium text-cool">{p.enApp}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
