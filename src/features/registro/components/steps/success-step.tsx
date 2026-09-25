"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, PartyPopper, Sparkles } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";

import { useRegistration } from "../../context/registration-context";
import { findCareer, findUniversity } from "../../data/catalog";
import { formatMxn, PLANS } from "../../data/plans";
import { Confetti } from "../confetti";
import { StepHeader } from "../step-header";

/** Paso final del estudiante: cuenta creada; entrada al panel o al plan ilimitado. */
export function SuccessStep() {
  const { state, dispatch } = useRegistration();
  const invited = state.flow === "invited";
  const university = findUniversity(state.goal.universityId);
  const career = findCareer(state.goal.universityId, state.goal.careerId);
  const alias = state.account.alias.trim() || state.account.fullName.split(" ")[0];
  const unlimited = PLANS.unlimited;

  return (
    <div className="flex flex-col gap-6 text-center">
      <Confetti />
      <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-gradient shadow-glow-secondary animate-in zoom-in-50 duration-500 motion-reduce:animate-none">
        <PartyPopper className="size-8 text-white" />
      </span>
      <StepHeader
        title={`¡Tu cuenta está lista, ${alias}!`}
        description={invited ? "Tu licencia ya está activa. Entra a tu panel y empieza a entrenar." : "Elige cómo quieres empezar a entrenar."}
      />

      {university && career && (
        <div className="mx-auto flex w-full max-w-sm items-center gap-3 rounded-xl border bg-background/40 p-3 text-left">
          <UniversityBadge id={university.id} label={university.short} />
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Tu meta</span>
            <span className="block truncate text-sm font-semibold">{career.name}</span>
          </span>
          {invited && <BadgeCheck className="ml-auto size-5 shrink-0 text-secondary" aria-label="Licencia activa" />}
        </div>
      )}

      {invited ? (
        <Button asChild size="lg">
          <Link href="/app/student">
            Ir a mi panel <ArrowRight />
          </Link>
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/app/student">
              Comenzar plan gratuito <ArrowRight />
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => dispatch({ type: "checkout", plan: "unlimited" })}
            className="group relative rounded-lg bg-gradient-to-r from-energy to-gold p-px transition-shadow hover:shadow-glow-energy focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex h-auto min-h-12 flex-col items-center justify-center gap-0.5 rounded-[calc(0.5rem-1px)] bg-card px-4 py-2.5 transition-colors group-hover:bg-card/80">
              <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Sparkles className="size-4 text-gold" aria-hidden /> Desbloquear acceso ilimitado
              </span>
              <span className="text-xs text-muted-foreground">
                {formatMxn(unlimited.priceMxn)}/{unlimited.period} · escuelas y carreras sin límite
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
