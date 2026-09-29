"use client";

import Link from "next/link";
import { ArrowRight, Gift, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ANNUAL_DISCOUNT, formatMxn, TUTOR_PLANS } from "../lib/tutor-plans";
import { trialDaysLeft } from "./student-trial";
import { useTutor } from "./tutor-context";

const STEPS = ["Elige tu plan", "Paga seguro", "¡Listo! Acceso ilimitado"];

/**
 * Anuncio de "sin plan" (padre o maestro que aún no paga). Se repite arriba de Estudiantes, Estadísticas y
 * Suscripción. `scroll`: en Suscripción el botón baja a los planes en vez de navegar.
 */
export function NoPlanHero({ scroll }: { scroll?: boolean }) {
  const { kind, panel } = useTutor();
  const plans = TUTOR_PLANS[kind];
  // El plan más barato completo (el Familia es por estudiante y pide 3: no es "desde").
  const from = Math.min(...plans.filter((p) => !p.perStudent).map((p) => p.priceMxn));
  const trialStudent = panel?.students.find((s) => s.access === "prueba" && s.trial) ?? null;
  const days = trialStudent?.trial ? trialDaysLeft(trialStudent.trial.endsAt) : null;
  const who = panel?.students[0]?.alias ?? (kind === "parent" ? "tu estudiante" : "tus alumnos");

  const cta = (
    <span className="flex items-center gap-2">
      <Sparkles /> Activar mi plan <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
    </span>
  );

  return (
    <section
      aria-labelledby="no-plan-title"
      className="relative rounded-3xl bg-[linear-gradient(135deg,var(--gold),var(--secondary)_45%,var(--primary))] p-px shadow-[0_0_60px_-20px_rgb(18_194_169/0.6)]"
    >
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-card px-5 py-7 sm:px-8 sm:py-9">
        {/* Luces de fondo */}
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-gold/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full bg-secondary/15 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(var(--foreground)_1px,transparent_1px)] [background-size:18px_18px]"
        />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
              <Sparkles className="size-3.5" aria-hidden /> Sin plan activo
            </span>
            <h2 id="no-plan-title" className="font-display text-2xl leading-tight font-bold text-balance sm:text-4xl">
              De momento no tienes un plan…
              <span className="block text-brand-gradient">¡pero es muy fácil de solucionarlo!</span>
            </h2>
            <p className="max-w-xl text-sm text-cool text-pretty sm:text-base">
              Actívalo en un minuto: <strong className="text-foreground">{who}</strong> entrena sin límites y tú ves cada
              avance, cada materia y cada examen, en tiempo real.
            </p>
            <ol className="flex flex-wrap gap-2">
              {STEPS.map((step, i) => (
                <li key={step} className="inline-flex items-center gap-2 rounded-full bg-muted/70 py-1 pr-3 pl-1 text-xs text-cool">
                  <span className="grid size-6 place-items-center rounded-full bg-brand-gradient text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-background/40 p-5 text-center backdrop-blur-sm lg:w-72">
            {days !== null && trialStudent ? (
              <div className="flex flex-col items-center">
                <span className="font-display text-5xl font-bold text-gold tabular-nums">{days}</span>
                <span className="text-sm text-cool text-balance">
                  {days === 1 ? "día" : "días"} de prueba le {days === 1 ? "queda" : "quedan"} a{" "}
                  <strong className="text-foreground">{trialStudent.alias}</strong>
                </span>
              </div>
            ) : (
              <span className="grid size-14 place-items-center rounded-2xl bg-gold/15 text-gold">
                <Gift className="size-7" aria-hidden />
              </span>
            )}
            {scroll ? (
              <Button
                variant="brand"
                size="lg"
                className="group w-full"
                onClick={() => document.getElementById("plans-title")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                {cta}
              </Button>
            ) : (
              <Button asChild variant="brand" size="lg" className="group w-full">
                <Link href="/app/dashboard/billing">{cta}</Link>
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Desde {formatMxn(from)} al mes · ahorra {Math.round(ANNUAL_DISCOUNT * 100)} % pagando el año
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
