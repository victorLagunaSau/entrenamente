"use client";

import type { LucideIcon } from "lucide-react";
import { ChartLine, Clock3, Flame, HeartHandshake, ShieldCheck, Target } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { UniversityBadge } from "@/components/layout/university-badge";

import { useRegistration } from "../context/registration-context";
import { UNIVERSITIES } from "../data/catalog";
import type { Flow } from "../types";

type Pitch = {
  title: React.ReactNode;
  body: string;
  benefits: { icon: LucideIcon; text: string }[];
};

const STUDENT: Pitch = {
  title: (
    <>
      Tu examen de admisión es un reto que <span className="text-brand-gradient">sí puedes ganar</span>.
    </>
  ),
  body: "Entrena con simulacros cortos, descubre qué te falta y llega al día del examen con confianza.",
  benefits: [
    { icon: Clock3, text: "Simulacros de 10 minutos, a tu ritmo" },
    { icon: Target, text: "Ruta personalizada para tu carrera" },
    { icon: Flame, text: "Rachas y logros que te mantienen constante" },
  ],
};

const PITCHES: Record<Flow | "welcome", Pitch> = {
  welcome: {
    title: (
      <>
        Prepararse para el examen <span className="text-brand-gradient">no tiene que dar miedo</span>.
      </>
    ),
    body: "Acompañamos a estudiantes y familias en el camino a la universidad, un simulacro a la vez.",
    benefits: [
      { icon: Clock3, text: "Simulacros cortos que caben en tu día" },
      { icon: ChartLine, text: "Avance claro por materia" },
      { icon: HeartHandshake, text: "Panel para que la familia acompañe" },
    ],
  },
  student: STUDENT,
  invited: STUDENT,
  parent: {
    title: (
      <>
        Acompaña su preparación <span className="text-brand-gradient">sin estar encima</span>.
      </>
    ),
    body: "Tu hijo/a entrena a su ritmo y tú ves su avance real desde tu propio panel.",
    benefits: [
      { icon: ChartLine, text: "Aciertos por materia y evolución en el tiempo" },
      { icon: ShieldCheck, text: "Tú activas su licencia; él o ella solo entrena" },
      { icon: HeartHandshake, text: "Un solo enlace para vincular su cuenta" },
    ],
  },
};

/**
 * Columna de marca. En escritorio es un panel tipo landing; en móvil se reduce
 * al logo grande para dejar todo el espacio al formulario.
 */
export function BrandAside() {
  const { state, step } = useRegistration();
  const pitch = PITCHES[step === "profile" || !state.flow ? "welcome" : state.flow];

  return (
    <aside className="flex flex-col items-center gap-8 text-center lg:items-start lg:text-left">
      <Logo variant="vertical" className="mb-2 h-36 sm:mb-0 sm:h-40 lg:hidden" priority />
      <Logo variant="full" className="hidden h-24 lg:block xl:h-28" priority />

      <div className="hidden flex-col gap-8 lg:flex">
        {/* key: el mensaje entra con un fundido al cambiar de perfil. */}
        <div key={state.flow ?? "welcome"} className="flex flex-col gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
          <h2 className="max-w-lg text-4xl leading-tight font-bold text-balance xl:text-5xl xl:leading-[1.1]">{pitch.title}</h2>
          <p className="max-w-md text-lg text-muted-foreground text-pretty">{pitch.body}</p>
        </div>

        <ul className="flex flex-col gap-3">
          {pitch.benefits.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-cool">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-secondary/20 bg-secondary/10 text-secondary">
                <Icon className="size-5" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Entrena para</p>
          <ul className="flex flex-wrap gap-2">
            {UNIVERSITIES.map((u) => (
              <li key={u.id}>
                <UniversityBadge id={u.id} label={u.short} size="sm" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
