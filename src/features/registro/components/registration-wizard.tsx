"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleAlert, LoaderCircle, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { RegistrationProvider, useRegistration } from "../context/registration-context";
import { SUBMIT_STEP } from "../lib/steps";
import type { Flow, StepId } from "../types";
import { BrandAside } from "./brand-aside";
import { CheckoutDialog } from "./checkout-dialog";
import { AccountStep } from "./steps/account-step";
import { CareerStep } from "./steps/career-step";
import { ExtraStep } from "./steps/extra-step";
import { InviteStep } from "./steps/invite-step";
import { NameStep } from "./steps/name-step";
import { ProfileStep } from "./steps/profile-step";
import { SuccessStep } from "./steps/success-step";
import { UniversityStep } from "./steps/university-step";
import { WizardProgress } from "./wizard-progress";

const STEP_COMPONENTS: Record<StepId, React.ComponentType> = {
  profile: ProfileStep,
  name: NameStep,
  account: AccountStep,
  university: UniversityStep,
  career: CareerStep,
  extra: ExtraStep,
  success: SuccessStep,
  invite: InviteStep,
};

/** Pasos con sus propios botones: bienvenida (elige perfil) y pantallas finales. */
const SELF_NAV_STEPS: StepId[] = ["profile", "success", "invite"];

export function RegistrationWizard({
  inviteCode,
  initialFlow,
}: {
  inviteCode?: string | null;
  /** Perfil ya elegido (p. ej. desde un plan de la landing): salta la bienvenida. */
  initialFlow?: Exclude<Flow, "invited"> | null;
}) {
  return (
    <RegistrationProvider inviteCode={inviteCode} initialFlow={initialFlow}>
      <WizardCard />
      <CheckoutDialog />
    </RegistrationProvider>
  );
}

function WizardCard() {
  const { state, step, next, back, canContinue, isLocked } = useRegistration();
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const firstRender = React.useRef(true);

  // Al cambiar de paso se enfoca su título (anuncio para lectores de pantalla) y se sube el scroll.
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    bodyRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
    bodyRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void next().then(() => {
      // Si el paso no es válido, se lleva el foco al primer campo con error.
      requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
    });
  };

  if (state.invite.status === "loading") {
    return (
      <CardFrame>
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground" role="status">
          <LoaderCircle className="size-8 animate-spin text-secondary" />
          Validando tu invitación…
        </div>
      </CardFrame>
    );
  }

  const StepComponent = STEP_COMPONENTS[step];
  const selfNav = SELF_NAV_STEPS.includes(step);
  const showBack = state.stepIndex > 0 && !isLocked;
  const flow = state.flow ?? "student";
  const nextLabel = step === SUBMIT_STEP[flow] ? "Crear cuenta" : step === "extra" ? "Continuar" : "Siguiente";

  return (
    <CardFrame>
      <form onSubmit={onSubmit} noValidate className="flex flex-col">
        {!selfNav && <WizardProgress />}

        {state.invite.status === "invalid" && step === "profile" && (
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            La invitación «{state.invite.code}» no es válida o ya expiró. Puedes registrarte de forma normal.
          </p>
        )}

        {/* key reinicia la animación de entrada en cada paso; la dirección decide el lado. */}
        <div ref={bodyRef} className={cn("scroll-mt-6 overflow-x-clip", !selfNav && "pt-6")}>
          <div
            key={step}
            className={cn(
              "animate-in fade-in-0 duration-300 ease-out motion-reduce:animate-none",
              state.direction === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8"
            )}
          >
            <StepComponent />
          </div>
        </div>

        {state.serverErrors.form && (
          <p role="alert" className="mt-5 flex items-start gap-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {state.serverErrors.form}
          </p>
        )}

        {!selfNav && (
          <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
            {showBack ? (
              <Button type="button" variant="ghost" onClick={back} disabled={state.busy}>
                <ArrowLeft /> Atrás
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              size="lg"
              // Se mantiene clicable para mostrar qué falta; solo se ve atenuado.
              aria-disabled={!canContinue}
              className={cn("min-w-36", !canContinue && "opacity-50 hover:bg-primary hover:shadow-none")}
            >
              {state.busy ? (
                <>
                  <LoaderCircle className="animate-spin" /> {step === SUBMIT_STEP[flow] ? "Creando…" : "Validando…"}
                </>
              ) : (
                <>
                  {nextLabel} <ArrowRight />
                </>
              )}
            </Button>
          </div>
        )}
      </form>

      {step === "profile" && (
        <p className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/auth" className="font-semibold text-brand-light underline-offset-4 hover:underline">
            Inicia sesión
          </Link>
        </p>
      )}
    </CardFrame>
  );
}

/** Landing de registro: panel de marca + formulario (dos columnas en escritorio). */
function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
      <BrandAside />
      <div className="w-full sm:mx-auto sm:max-w-xl lg:max-w-none">
        <div className="w-full sm:rounded-3xl sm:border sm:bg-card/90 sm:p-8 sm:shadow-2xl sm:backdrop-blur lg:p-10">{children}</div>
      </div>
    </div>
  );
}
