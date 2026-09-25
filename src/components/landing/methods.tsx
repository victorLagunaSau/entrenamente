import { CalendarCheck, Flag, Flame, Infinity as InfinityIcon, Moon, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

/** Calendario de 14 días con simulacros programados rumbo a la fecha del examen. */
function PlanVisual() {
  const scheduled = new Set([1, 3, 5, 7, 8, 10, 12]);
  return (
    <div aria-hidden className="rounded-2xl border bg-background/60 p-4">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: 14 }, (_, i) => {
          const last = i === 13;
          const done = scheduled.has(i) && i < 6;
          return (
            <div
              key={i}
              className={cn(
                "grid aspect-square place-items-center rounded-lg text-[11px] font-semibold",
                last
                  ? "bg-brand-gradient text-white shadow-glow-primary"
                  : done
                    ? "bg-secondary/20 text-secondary"
                    : scheduled.has(i)
                      ? "border border-secondary/50 text-secondary"
                      : "bg-muted/60 text-muted-foreground/60"
              )}
            >
              {last ? <Flag className="size-3.5" /> : i + 1}
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-2 rounded-full bg-secondary" /> Simulacro programado
        <span className="ml-3 size-2 rounded-full bg-primary" /> Tu examen
      </p>
    </div>
  );
}

function FreeVisual() {
  return (
    <div aria-hidden className="relative grid h-36 place-items-center rounded-2xl border bg-background/60">
      <InfinityIcon className="size-20 text-brand-light/80" strokeWidth={1.5} />
      <span className="absolute right-4 bottom-4 grid size-10 place-items-center rounded-full bg-primary shadow-glow-primary">
        <Play className="ml-0.5 size-4 fill-white text-white" />
      </span>
    </div>
  );
}

/** Siete días: cada mini examen un poco más difícil que el anterior. */
function StreakVisual() {
  return (
    <div aria-hidden className="rounded-2xl border border-energy/25 bg-background/60 p-4">
      <div className="flex h-24 items-end gap-2">
        {[28, 38, 48, 58, 68, 82, 100].map((h, i) => (
          <div
            key={i}
            className={cn("flex-1 rounded-md", i === 6 ? "animate-pulse-glow bg-energy" : "bg-energy/35")}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Moon className="size-3.5 text-gold" /> Cierra hoy a las 11:59 p. m.
      </p>
    </div>
  );
}

const METHODS = [
  {
    icon: CalendarCheck,
    tag: "Plan de exámenes de práctica",
    title: "Llega listo el día del examen",
    body: "Exámenes programados automáticamente para ayudarte a estar listo antes de la fecha de tu examen.",
    visual: <PlanVisual />,
    accent: "text-secondary bg-secondary/15",
    className: "lg:col-span-2",
  },
  {
    icon: InfinityIcon,
    tag: "Exámenes libres",
    title: "Practica sin límites",
    body: "Cada vez que quieras realizar un examen, puedes entrar y practicar sin límites.",
    visual: <FreeVisual />,
    accent: "text-brand-light bg-brand-light/15",
    className: "",
  },
  {
    icon: Flame,
    tag: "Racha",
    title: "Un mini examen al día",
    body: "Mini exámenes diarios con preguntas progresivamente más difíciles, que debes completar antes de la medianoche.",
    visual: <StreakVisual />,
    accent: "text-energy bg-energy/15",
    className: "lg:col-span-3 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10",
  },
];

export function Methods() {
  return (
    <section aria-labelledby="metodos" className="relative isolate py-20 sm:py-28">
      <div aria-hidden className="absolute inset-x-0 top-1/3 -z-10 mx-auto h-96 max-w-4xl rounded-full bg-secondary/10 blur-[120px]" />
      <div className="reveal mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="metodos"
          eyebrow="Métodos de estudio"
          title={
            <>
              Tres formas de entrenar, <span className="text-brand-gradient">un solo objetivo: tu lugar</span>
            </>
          }
          subtitle="Combínalas como quieras: constancia diaria, práctica libre y un plan que se adapta a tu fecha."
        />

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {METHODS.map(({ icon: Icon, ...m }) => (
            <article
              key={m.tag}
              className={cn(
                "flex flex-col gap-6 rounded-3xl border bg-card/70 p-6 transition-colors hover:border-secondary/40 sm:p-8",
                m.className
              )}
            >
              <div className="flex flex-col gap-3">
                <span className={cn("inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", m.accent)}>
                  <Icon className="size-3.5" /> {m.tag}
                </span>
                <h3 className="text-2xl font-semibold">{m.title}</h3>
                <p className="text-muted-foreground">{m.body}</p>
              </div>
              {m.visual}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
