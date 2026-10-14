"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, CreditCard, Sparkles, TriangleAlert, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ParentPlanGrid, WhyTutor, type ChooseHandler } from "@/features/pricing/components/parent-plan-cards";
import { useImpression, usePricing } from "@/features/pricing/hooks/use-pricing";
import { checkoutHref as pricingCheckoutHref, parentPlans } from "@/features/pricing/lib/pricing";
import { cn } from "@/lib/utils";

import {
  ANNUAL_DISCOUNT,
  annualPriceOf,
  checkoutHref,
  currentChoice,
  formatDate,
  formatMxn,
  planName,
  priceOf,
  savingsOf,
  TUTOR_COPY,
  TUTOR_PLANS,
  upgradeOffers,
} from "../lib/tutor-plans";
import type { TutorLicense } from "../services/tutor-service";
import { NoPlanHero } from "./no-plan-hero";
import { useTutor } from "./tutor-context";

const SOURCE: Record<TutorLicense["source"], string> = {
  stripe: "Pago con tarjeta",
  coupon: "Cupón",
  admin: "Cortesía de Entrena Mente",
};

/** Pestaña Suscripción: estado del plan, muro de plan vencido y ampliación (upsell). */
export function BillingTab() {
  const { kind, panel, lapsed } = useTutor();
  const license = panel!.license;
  const current = currentChoice(kind, license);
  // Padres: precios del catálogo de Supabase (los mismos de /pricing). Maestros: catálogo provisional en código.
  const pricing = usePricing("billing");
  const plans = kind === "parent" ? parentPlans(pricing.catalog) : TUTOR_PLANS[kind];
  const showCatalog = !license || lapsed;
  useImpression(pricing, kind === "parent" && showCatalog ? "parent" : null, "billing");
  const router = useRouter();
  const choose: ChooseHandler = ({ plan, seats }, period) => {
    const intent = { planId: plan.id, interval: period === "anual" ? ("annual" as const) : ("monthly" as const), seats };
    if (kind === "parent") pricing.choose("parent", intent);
    else router.push(pricingCheckoutHref(intent));
  };
  // Recomendado: el siguiente plan más grande que el actual (o el primero si no hay plan).
  const recommended = plans.find((p) => p.seats > (license?.seats ?? 0) || p.perStudent) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {lapsed && (
        <p role="alert" className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-cool">
          <TriangleAlert className="size-5 shrink-0 text-destructive" aria-hidden />
          <span>
            <strong className="text-foreground">Tu suscripción no se encuentra activa.</strong> Tus estudiantes han pasado a
            modo inactivo. Renueva o amplía tu plan para restaurar su acceso ilimitado a las evaluaciones.
          </span>
        </p>
      )}

      {!license ? (
        <NoPlanHero scroll />
      ) : (
      <section aria-labelledby="plan-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-brand-light">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Estado del plan</p>
            <h2 id="plan-title" className="text-xl font-bold">
              {license ? planName(kind, license) : "Sin plan"}
            </h2>
          </div>
          {license && (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                license.active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              )}
            >
              {license.active ? "Activo" : "Vencido"}
            </span>
          )}
        </div>

        {license ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Info icon={Users} label="Cupos" value={`${license.used} de ${license.seats} en uso`} />
            <Info
              icon={CalendarClock}
              label={license.active ? (license.autoRenew ? "Próximo cobro" : "Vence") : "Venció"}
              value={formatDate(license.expiresAt)}
            />
            <Info icon={CreditCard} label="Origen" value={SOURCE[license.source]} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Elige un plan para dar acceso ilimitado a {TUTOR_COPY[kind].students} y desbloquear las estadísticas.
          </p>
        )}

        {lapsed && current && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="brand" size="lg">
              <Link href={checkoutHref(current, "mensual")}>Renovar con suscripción mensual · {formatMxn(priceOf(current))}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={checkoutHref(current, "anual")}>Renovar por un año · {formatMxn(annualPriceOf(current))}</Link>
            </Button>
          </div>
        )}
      </section>
      )}

      {license?.active && <UpgradeOffers />}

      {/* Con plan activo no se muestra el catálogo: solo sus datos y la oferta para sumar estudiantes. */}
      {showCatalog && (
      <section aria-labelledby="plans-title" className="flex flex-col gap-3">
        <div>
          <h2 id="plans-title" className="text-lg font-bold">
            {license ? "Mejorar Plan / Agregar más Estudiantes" : "Elige tu plan"}
          </h2>
          <p className="text-sm text-muted-foreground">Precios en pesos mexicanos. Paga mes a mes o por un año con {Math.round(ANNUAL_DISCOUNT * 100)} % de descuento.</p>
        </div>
        {kind === "parent" && !license && <WhyTutor />}
        <ParentPlanGrid
          plans={plans}
          license={license}
          currentId={current?.plan.id}
          recommendedId={license ? recommended?.id : undefined}
          showSavings={kind === "parent"}
          onChoose={choose}
        />
      </section>
      )}
    </div>
  );
}

/**
 * Con plan activo: invitación a sumar estudiantes pagando solo la diferencia (Tutor → Dúo, Dúo → Familia…).
 * Cada oferta paga directo, mensual o anual.
 */
function UpgradeOffers() {
  const { kind, panel } = useTutor();
  const license = panel!.license!;
  const offers = upgradeOffers(kind, license);
  if (offers.length === 0) return null;
  const current = currentChoice(kind, license)!;

  return (
    <section
      aria-labelledby="upgrade-title"
      className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,var(--secondary),var(--primary))] p-px shadow-[0_0_60px_-24px_rgb(18_194_169/0.7)]"
    >
      <div className="relative flex flex-col gap-5 rounded-[calc(1.5rem-1px)] bg-card p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-secondary/15 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow-secondary">
            <UserPlus className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="upgrade-title" className="font-display text-xl font-bold text-balance sm:text-2xl">
              ¿Alguien más en casa se prepara para su examen?
            </h2>
            <p className="text-sm text-cool text-pretty">
              Hoy pagas {formatMxn(priceOf(current))} al mes por {current.seats}{" "}
              {current.seats === 1 ? "estudiante" : "estudiantes"}. Suma a otro y paga solo la diferencia: tus estudiantes
              actuales conservan su lugar.
            </p>
          </div>
        </div>

        <ul className="relative grid gap-3 md:grid-cols-2">
          {offers.map((o, i) => (
            <li
              key={`${o.choice.plan.id}-${o.choice.seats}`}
              className={cn("flex flex-col gap-4 rounded-2xl border bg-background/40 p-5", i === 0 && "border-secondary/50")}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-secondary uppercase">
                    {o.added === 1 ? "Agrega un estudiante más" : `Agrega ${o.added} estudiantes más`}
                  </p>
                  <h3 className="text-lg font-bold">
                    {o.choice.plan.name}
                    {o.choice.plan.perStudent && ` · ${o.choice.seats} estudiantes`}
                  </h3>
                </div>
                {i === 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs text-secondary">
                    <Sparkles className="size-3" aria-hidden /> Recomendado
                  </span>
                )}
              </div>
              <p className="text-cool">
                Paga solo{" "}
                <span className="font-display text-4xl font-bold text-foreground tabular-nums">+{formatMxn(o.extra)}</span> al mes
              </p>
              <p className="-mt-2 text-sm text-muted-foreground">
                Total {formatMxn(priceOf(o.choice))} al mes o {formatMxn(annualPriceOf(o.choice))} por un año
                {savingsOf(kind, o.choice) > 0 && ` · ahorras ${formatMxn(savingsOf(kind, o.choice))} al mes frente a planes individuales`}
              </p>
              <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                <Button asChild variant={i === 0 ? "brand" : "outline"} className="group flex-1">
                  <Link href={checkoutHref(o.choice, "mensual")}>
                    Agregar y pagar mensual <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="flex-1 text-secondary hover:text-secondary">
                  <Link href={checkoutHref(o.choice, "anual")}>Pago anual −{Math.round(ANNUAL_DISCOUNT * 100)} %</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-brand-light" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium">{value}</dd>
      </div>
    </div>
  );
}
