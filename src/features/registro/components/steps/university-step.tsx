"use client";

import { Check } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { cn } from "@/lib/utils";

import { useFieldError, useRegistration } from "../../context/registration-context";
import { UNIVERSITIES } from "../../data/catalog";
import { StepHeader } from "../step-header";

/** Paso de meta (1/2): universidad principal. Elegir una avanza directo a la carrera. */
export function UniversityStep() {
  const { state, dispatch, goalErrors } = useRegistration();
  const isParent = state.flow === "parent";
  const error = useFieldError("universityId", goalErrors, "university");

  const choose = (universityId: string) => {
    // Cambiar de universidad invalida la carrera elegida.
    if (universityId !== state.goal.universityId) {
      dispatch({ type: "setGoal", patch: { universityId, careerId: null } });
    }
    dispatch({ type: "go", delta: 1 });
  };

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title={isParent ? "¿A qué universidad quiere entrar tu hijo/a?" : "¿A qué universidad quieres entrar?"}
        description="Elige tu opción principal; con ella armamos tu plan de entrenamiento."
      />

      <div className="grid grid-cols-2 gap-3">
        {UNIVERSITIES.map((u) => {
          const selected = state.goal.universityId === u.id;
          return (
            <button
              key={u.id}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(u.id)}
              className={cn(
                "group relative flex min-h-28 flex-col items-start justify-between gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-200",
                "hover:-translate-y-0.5 hover:border-brand-light/60 hover:bg-accent/40 motion-reduce:hover:translate-y-0",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                selected ? "border-primary bg-primary/10 shadow-glow-primary" : "border-border bg-background/40"
              )}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <UniversityBadge id={u.id} label={u.short} size="md" />
                {selected ? (
                  <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : (
                  u.exam && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-cool">{u.exam}</span>
                  )
                )}
              </span>
              <span className="line-clamp-2 text-xs leading-snug text-cool">{u.name}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
