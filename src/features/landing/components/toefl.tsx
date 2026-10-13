import { Award, BookOpenCheck, Check, GraduationCap, Plane, Timer } from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

const PARA = [
  { icon: GraduationCap, text: "Titularte: muchas universidades piden un puntaje de inglés para darte el título." },
  { icon: Plane, text: "Estudiar en el extranjero o aplicar a becas y posgrados." },
  { icon: Award, text: "Acreditar tu nivel de inglés en tu currículum." },
];

const OPCIONES = [
  { key: "A", text: "for", puntos: 0.25 },
  { key: "B", text: "since", puntos: 1 },
  { key: "C", text: "from", puntos: 0.5 },
  { key: "D", text: "during", puntos: 0 },
];

/** Reactivo de ejemplo en inglés con la misma mecánica: reloj y respuesta ponderada. */
function ToeflCard() {
  return (
    <div aria-hidden className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-secondary/30 to-primary/30 opacity-60 blur-3xl" />
      <div className="animate-float rounded-3xl border bg-card/90 p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-3xl font-bold tracking-tight text-brand-gradient">TOEFL</span>
          <span className="flex items-center gap-1.5 rounded-xl border border-energy/50 bg-energy/10 px-3 py-1 font-mono text-sm font-bold text-energy">
            <Timer className="size-4" /> 00:42
          </span>
        </div>
        <p className="mt-5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Choose the best option</p>
        <p className="mt-2 font-display text-lg font-semibold">She has lived in Monterrey ____ 2019.</p>
        <ul className="mt-4 grid grid-cols-2 gap-2.5">
          {OPCIONES.map((o) => (
            <li
              key={o.key}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm",
                o.puntos === 1 ? "border-secondary bg-secondary/15 shadow-glow-secondary" : "bg-background/40"
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold",
                  o.puntos === 1 ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {o.puntos === 1 ? <Check className="size-3.5" /> : o.key}
              </span>
              <span className="font-medium">{o.text}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">{o.puntos.toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-background/60 p-3 text-sm text-cool">
          <strong className="text-secondary">Since</strong> marca el punto de inicio (2019). <em>For</em> se usa con una
          duración: <em>for five years</em>.
        </p>
      </div>
    </div>
  );
}

export function Toefl() {
  return (
    <section id="toefl" aria-labelledby="toefl-title" className="relative isolate overflow-hidden py-20 sm:py-28">
      <div aria-hidden className="absolute top-1/3 -right-40 -z-10 size-[28rem] rounded-full bg-secondary/10 blur-[120px]" />
      <div className="reveal mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <SectionHeading
            id="toefl-title"
            eyebrow="Certificación de inglés"
            title={
              <>
                Llega al TOEFL <span className="text-brand-gradient">con el reloj ya dominado</span>
              </>
            }
            subtitle="Preparación intensiva para el examen de suficiencia en inglés, con la misma mecánica de EntrenaMente: contra reloj, respuestas ponderadas y tu Guía de errores al terminar."
            className="lg:items-start lg:text-left"
          />
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Te sirve para</p>
            <ul className="mt-4 flex flex-col gap-3">
              {PARA.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-cool">
                  <Icon className="mt-0.5 size-5 shrink-0 text-secondary" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="flex gap-2 text-xs text-muted-foreground">
            <BookOpenCheck className="size-4 shrink-0" />
            TOEFL es una marca registrada de ETS. EntrenaMente es una herramienta independiente de práctica y no está afiliada a
            ETS.
          </p>
        </div>
        <div className="px-2 sm:px-8 lg:px-0">
          <ToeflCard />
        </div>
      </div>
    </section>
  );
}
