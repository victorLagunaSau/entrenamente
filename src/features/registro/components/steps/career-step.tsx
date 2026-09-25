"use client";

import { Info } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";

import { useFieldError, useRegistration } from "../../context/registration-context";
import { findCareer, findUniversity } from "../../data/catalog";
import { FormField } from "../form-field";
import { SearchSelect } from "../search-select";
import { StepHeader } from "../step-header";

/** Paso de meta (2/2): carrera principal dentro de la universidad elegida. */
export function CareerStep() {
  const { state, dispatch, back, goalErrors } = useRegistration();
  const isParent = state.flow === "parent";
  const university = findUniversity(state.goal.universityId);
  const career = findCareer(state.goal.universityId, state.goal.careerId);
  const error = useFieldError("careerId", goalErrors, "career");

  if (!university) return null;

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title={isParent ? "¿Qué carrera quiere estudiar?" : "¿Cuál es tu carrera principal?"}
        description="Busca por nombre y elige una."
      />

      <div className="flex items-center gap-3 rounded-xl border bg-background/40 p-3">
        <UniversityBadge id={university.id} label={university.short} />
        <span className="min-w-0 flex-1 truncate text-sm text-cool">{university.name}</span>
        <button
          type="button"
          onClick={back}
          className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-brand-light underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Cambiar
        </button>
      </div>

      <FormField id="reg-career" label="Carrera" error={error} hint={`${university.careers.length} carreras disponibles`}>
        {(a11y) => (
          <SearchSelect
            {...a11y}
            placeholder="Busca tu carrera"
            options={university.careers.map((c) => ({ id: c.id, label: c.name }))}
            value={career ? { id: career.id, label: career.name } : null}
            onChange={(v) => dispatch({ type: "setGoal", patch: { careerId: v?.id ?? null } })}
            onBlur={() => dispatch({ type: "touch", field: "careerId" })}
          />
        )}
      </FormField>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
        Más adelante podrás agregar más escuelas y carreras.
      </p>
    </div>
  );
}
