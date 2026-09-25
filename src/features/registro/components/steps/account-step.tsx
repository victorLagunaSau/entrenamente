"use client";

import { Input } from "@/components/ui/input";

import { useFieldError, useRegistration } from "../../context/registration-context";
import type { AccountData } from "../../types";
import { FormField, invalidClass } from "../form-field";
import { PasswordInput } from "../password-field";
import { StepHeader } from "../step-header";

/** Paso 2A / 2B (segunda parte): credenciales. */
export function AccountStep() {
  const { state, dispatch, accountErrors } = useRegistration();
  const { account } = state;
  const isParent = state.flow === "parent";
  const greetingName = account.alias.trim() || account.fullName.trim().split(/\s+/)[0];

  const set = (patch: Partial<AccountData>) => dispatch({ type: "setAccount", patch });
  const touch = (field: keyof AccountData) => () => dispatch({ type: "touch", field });
  const err = {
    email: useFieldError("email", accountErrors, "account"),
    password: useFieldError("password", accountErrors, "account"),
  };

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Datos para registrar tu cuenta"
        description={
          <>
            Mucho gusto{greetingName && <>, <span className="font-semibold text-cool">{greetingName}</span></>}. Con
            este correo y contraseña entrarás {isParent ? "como tutor en" : "a"} Entrena Mente.
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <FormField id="reg-email" label="Correo electrónico" error={err.email}>
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="tu@correo.com"
              value={account.email}
              onChange={(e) => set({ email: e.target.value })}
              onBlur={touch("email")}
              className={invalidClass}
            />
          )}
        </FormField>

        <FormField id="reg-password" label="Contraseña" error={err.password}>
          {(a11y) => (
            <PasswordInput {...a11y} value={account.password} onChange={(password) => set({ password })} onBlur={touch("password")} />
          )}
        </FormField>
      </div>
    </div>
  );
}
