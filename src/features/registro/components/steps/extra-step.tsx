"use client";

import { Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useRegistration } from "../../context/registration-context";
import { FormField } from "../form-field";
import { InviteBanner } from "../invite-banner";
import { StepHeader } from "../step-header";

/** Paso 4A: información complementaria, toda opcional. */
export function ExtraStep() {
  const { state, dispatch } = useRegistration();
  const { extra } = state;

  return (
    <div className="flex flex-col gap-6">
      {state.flow === "invited" && <InviteBanner />}
      <StepHeader title="Cuéntanos un poco de ti" description="Es opcional: nos ayuda a comparar tu avance con estudiantes como tú." />

      <FormField id="reg-origin" label="Escuela de procedencia" optional>
        {(a11y) => (
          <Input
            {...a11y}
            autoComplete="off"
            maxLength={120}
            disabled={extra.notStudying}
            placeholder={extra.notStudying ? "No aplica" : "Ej. CCH Sur, Prepa 6, CECyT 9"}
            value={extra.originSchool}
            onChange={(e) => dispatch({ type: "setExtra", patch: { originSchool: e.target.value } })}
          />
        )}
      </FormField>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background/40 p-4 transition-colors hover:bg-accent/40 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={extra.notStudying}
          onChange={(e) =>
            dispatch({
              type: "setExtra",
              patch: { notStudying: e.target.checked, ...(e.target.checked && { originSchool: "" }) },
            })
          }
        />
        <span
          aria-hidden
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-[5px] border-2 transition-colors",
            extra.notStudying ? "border-primary bg-primary text-primary-foreground" : "border-border"
          )}
        >
          {extra.notStudying && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="text-sm text-cool">Actualmente no me encuentro estudiando</span>
      </label>
    </div>
  );
}
