"use client";

import { Info } from "lucide-react";

import { CareerSearch, ProximamenteNote } from "@/features/catalogo";

import { useFieldError, useRegistration } from "../../context/registration-context";
import { FormField } from "../form-field";
import { StepHeader } from "../step-header";

/** Paso 1: ¿qué quieres estudiar y dónde? Antes de pedir datos, para validar que tenemos su carrera. */
export function CareerStep() {
  const { state, dispatch, goalErrors } = useRegistration();
  const isParent = state.flow === "parent";
  const error = useFieldError("careerId", goalErrors, "career");

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title={isParent ? "¿Qué quiere estudiar tu hijo/a y dónde?" : "¿Qué quieres estudiar y dónde?"}
        description={
          isParent
            ? "Busca la carrera y elige la universidad. Así preparamos su examen con el formato real."
            : "Busca la carrera y elige la universidad. Así preparamos tu examen con el formato real."
        }
      />

      <FormField id="reg-career" label="Carrera y universidad" error={error}>
        {(a11y) => (
          <CareerSearch
            id={a11y.id}
            invalid={a11y["aria-invalid"]}
            describedBy={a11y["aria-describedby"]}
            value={state.goal.careerId}
            onChange={(c) =>
              dispatch({
                type: "setGoal",
                patch: { universityId: c?.universityId ?? null, careerId: c?.careerId ?? null },
              })
            }
          />
        )}
      </FormField>

      <ProximamenteNote careerId={state.goal.careerId} />

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
        {isParent ? "Después podrás invitar a más hijos con otra carrera." : "Más adelante podrás agregar más escuelas y carreras."}
      </p>
    </div>
  );
}
