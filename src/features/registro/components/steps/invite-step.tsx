"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShareInvite } from "@/features/invitacion";

import { useRegistration } from "../../context/registration-context";
import { formatMxn, PLANS } from "../../data/plans";
import { ConfirmEmailNotice } from "../confirm-email-notice";
import { StepHeader } from "../step-header";

/** Paso final del padre: su enlace único (el mismo de su panel) para que el estudiante herede su meta. */
export function InviteStep() {
  const { state, dispatch } = useRegistration();
  const invite = state.createdInvite;
  if (!invite) return null;

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Invita a tu hijo/a"
        description="Cuando se registre con este enlace quedará vinculado a tu panel y su plan de entrenamiento arrancará con la universidad y carrera que elegiste."
      />

      <ShareInvite link={invite} />

      <button
        type="button"
        onClick={() => dispatch({ type: "checkout", plan: "family-basic" })}
        className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4 text-left transition-colors hover:bg-gold/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Users className="size-5 shrink-0 text-gold" aria-hidden />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold text-foreground">¿Más carreras o más de un estudiante?</span>
          <span className="block text-muted-foreground">
            Paquete Familiar desde {formatMxn(PLANS["family-basic"].priceMxn)}/{PLANS["family-basic"].period}
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-gold" aria-hidden />
      </button>

      <ConfirmEmailNotice />

      <Button asChild size="lg">
        <Link href="/app/dashboard">
          Ir a mi panel <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
