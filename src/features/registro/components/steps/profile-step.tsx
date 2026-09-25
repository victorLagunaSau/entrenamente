"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRight, GraduationCap, HeartHandshake } from "lucide-react";

import { cn } from "@/lib/utils";

import { useRegistration } from "../../context/registration-context";
import type { Flow } from "../../types";
import { StepHeader } from "../step-header";

const CHOICES: {
  flow: Exclude<Flow, "invited">;
  icon: LucideIcon;
  title: string;
  body: string;
  tone: string;
}[] = [
  {
    flow: "student",
    icon: GraduationCap,
    title: "Soy estudiante",
    body: "Voy a presentar mi examen de admisión y quiero llegar preparado.",
    tone: "bg-primary/15 text-brand-light group-hover:bg-primary group-hover:text-primary-foreground",
  },
  {
    flow: "parent",
    icon: HeartHandshake,
    title: "Soy mamá, papá o tutor",
    body: "Quiero acompañar a mi hijo/a y ver cómo avanza en su preparación.",
    tone: "bg-secondary/15 text-secondary group-hover:bg-secondary group-hover:text-secondary-foreground",
  },
];

/** Bienvenida: cada opción arranca su flujo directamente (A estudiante, B padre/tutor). */
export function ProfileStep() {
  const { dispatch } = useRegistration();

  const choose = (flow: Exclude<Flow, "invited">) => {
    dispatch({ type: "chooseFlow", flow });
    dispatch({ type: "go", delta: 1 });
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <StepHeader
        title="Elige tu perfil"
        description="En menos de 2 minutos tendrás tu cuenta lista."
        className="text-center lg:text-left"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {CHOICES.map(({ flow, icon: Icon, title, body, tone }) => (
          <button
            key={flow}
            type="button"
            onClick={() => choose(flow)}
            className={cn(
              // Móvil: fila compacta (ícono a la izquierda). Desde sm: tarjeta vertical.
              "group relative flex items-center gap-4 rounded-2xl border-2 bg-background/40 p-4 text-left transition-all duration-200 sm:flex-col sm:items-start sm:p-6",
              "hover:-translate-y-0.5 hover:border-brand-light/60 hover:bg-accent/40 hover:shadow-glow-primary",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:hover:translate-y-0"
            )}
          >
            <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl transition-colors sm:size-14", tone)}>
              <Icon className="size-6 sm:size-7" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none sm:gap-1.5">
              <span className="font-display text-base font-semibold text-foreground sm:text-lg">{title}</span>
              <span className="text-sm leading-snug text-muted-foreground text-pretty">{body}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-light sm:mt-auto">
              <span className="hidden sm:inline">Empezar</span>
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1 motion-reduce:transition-none sm:size-4" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
