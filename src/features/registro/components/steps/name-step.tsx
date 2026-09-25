"use client";

import { Input } from "@/components/ui/input";

import { useFieldError, useRegistration } from "../../context/registration-context";
import type { AccountData } from "../../types";
import { FormField, invalidClass } from "../form-field";
import { InviteBanner } from "../invite-banner";
import { StepHeader } from "../step-header";

/** Paso 2A / 2B (primera parte): presentación. El alias solo aplica a estudiantes. */
export function NameStep() {
  const { state, dispatch, accountErrors } = useRegistration();
  const isParent = state.flow === "parent";
  const { account } = state;

  const set = (patch: Partial<AccountData>) => dispatch({ type: "setAccount", patch });
  const touch = (field: keyof AccountData) => () => dispatch({ type: "touch", field });
  const err = {
    fullName: useFieldError("fullName", accountErrors, "name"),
    alias: useFieldError("alias", accountErrors, "name"),
  };

  return (
    <div className="flex flex-col gap-6">
      {state.flow === "invited" && <InviteBanner />}
      <StepHeader
        title="¡Hola! ¿Cómo te llamas?"
        description={
          isParent
            ? "Así sabremos cómo dirigirnos a ti en tu perfil de tutor."
            : "Queremos conocerte para acompañarte en tu preparación."
        }
      />

      <div className="flex flex-col gap-5">
        <FormField id="reg-name" label="Tu nombre completo" error={err.fullName}>
          {(a11y) => (
            <Input
              {...a11y}
              autoComplete="name"
              autoCapitalize="words"
              placeholder="Nombre y apellidos"
              value={account.fullName}
              onChange={(e) => set({ fullName: e.target.value })}
              onBlur={touch("fullName")}
              className={invalidClass}
            />
          )}
        </FormField>

        {!isParent && (
          <FormField
            id="reg-alias"
            label="¿Cómo te gustaría que te digamos?"
            optional
            hint="Así te saludaremos y así te verán en rachas y logros."
            error={err.alias}
          >
            {(a11y) => (
              <Input
                {...a11y}
                autoComplete="nickname"
                autoCapitalize="words"
                placeholder="Ej. Mike, Mary, Fer…"
                maxLength={20}
                value={account.alias}
                onChange={(e) => set({ alias: e.target.value })}
                onBlur={touch("alias")}
                className={invalidClass}
              />
            )}
          </FormField>
        )}
      </div>
    </div>
  );
}
