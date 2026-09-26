"use client";

import { Check, CircleAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    acceptedPrivacy: useFieldError("acceptedPrivacy", accountErrors, "account"),
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

        <PrivacyConsent
          checked={account.acceptedPrivacy}
          error={err.acceptedPrivacy}
          isParent={isParent}
          onChange={(acceptedPrivacy) => {
            set({ acceptedPrivacy });
            touch("acceptedPrivacy")();
          }}
        />
      </div>
    </div>
  );
}

/** Aceptación del aviso de privacidad y términos (obligatoria; incluye consentimiento para menores). */
function PrivacyConsent({
  checked,
  error,
  isParent,
  onChange,
}: {
  checked: boolean;
  error?: string;
  isParent: boolean;
  onChange: (checked: boolean) => void;
}) {
  const link = "font-semibold text-brand-light underline-offset-4 hover:underline";
  return (
    <div className="flex flex-col gap-2">
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-xl border bg-background/40 p-4 transition-colors hover:bg-accent/40 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
          error && "border-destructive"
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "reg-privacy-error" : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border-2 transition-colors",
            checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
          )}
        >
          {checked && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="text-sm leading-relaxed text-cool">
          Acepto el{" "}
          <a href="/legal/privacidad" target="_blank" rel="noopener" className={link}>
            Aviso de privacidad
          </a>{" "}
          y los{" "}
          <a href="/legal/terminos" target="_blank" rel="noopener" className={link}>
            Términos y condiciones
          </a>
          .
          {!isParent && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Si eres menor de edad, confirmas que tu mamá, papá o tutor los conoce y está de acuerdo.
            </span>
          )}
        </span>
      </label>
      {error && (
        <p id="reg-privacy-error" className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
