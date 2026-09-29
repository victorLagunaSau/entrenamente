"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Check, CreditCard, Eye, HeartHandshake, Minus, PiggyBank, Plus, Sparkles, Star, TriangleAlert, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  type PlanChoice,
  type TutorKind,
  type TutorPlan,
} from "../lib/tutor-plans";
import type { TutorLicense } from "../services/tutor-service";
import { NoPlanHero } from "./no-plan-hero";
import { useTutor } from "./tutor-context";

const SOURCE: Record<TutorLicense["source"], string> = {
  stripe: "Pago con tarjeta",
  coupon: "Cupón",
  admin: "Cortesía de Entrena Mente",
};

// Tope del selector del Plan Familia (más estudiantes: plan a la medida).
const MAX_FAMILY_SEATS = 30;

/** Pestaña Suscripción: estado del plan, muro de plan vencido y ampliación (upsell). */
export function BillingTab() {
  const { kind, panel, lapsed } = useTutor();
  const license = panel!.license;
  const current = currentChoice(kind, license);
  const plans = TUTOR_PLANS[kind];
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

      <section aria-labelledby="plans-title" className="flex flex-col gap-3">
        <div>
          <h2 id="plans-title" className="text-lg font-bold">
            {license ? "Mejorar Plan / Agregar más Estudiantes" : "Elige tu plan"}
          </h2>
          <p className="text-sm text-muted-foreground">Precios en pesos mexicanos. Paga mes a mes o por un año con {Math.round(ANNUAL_DISCOUNT * 100)} % de descuento.</p>
        </div>
        {kind === "parent" && <WhyTutor />}
        <ul className={cn("grid gap-3", plans.length === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2")}>
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              kind={kind}
              plan={p}
              license={license}
              isCurrent={current?.plan.id === p.id}
              recommended={!!license && recommended?.id === p.id && current?.plan.id !== p.id}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PlanCard({
  kind,
  plan,
  license,
  isCurrent,
  recommended,
}: {
  kind: TutorKind;
  plan: TutorPlan;
  license: TutorLicense | null;
  isCurrent: boolean;
  recommended: boolean;
}) {
  // Plan por estudiante: por defecto uno más de los que ya tiene (nunca menos del mínimo del plan).
  const minSeats = plan.perStudent ? Math.max(plan.seats, isCurrent && license ? license.seats + 1 : plan.seats) : plan.seats;
  const [seats, setSeats] = React.useState(minSeats);
  const choice: PlanChoice = { plan, seats: plan.perStudent ? Math.max(seats, minSeats) : plan.seats };
  const total = priceOf(choice);
  const saving = savingsOf(kind, choice);
  // Solo se ofrece subir de cupos; el plan fijo que ya tiene no lleva botón.
  const canChoose = !license || choice.seats > license.seats;

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-5",
        recommended && "border-secondary/50 shadow-glow-secondary"
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold">{plan.name}</h3>
          {plan.badge && !recommended && !(isCurrent && license) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-gold">
              <Star className="size-3 fill-current" aria-hidden /> {plan.badge}
            </span>
          )}
          {isCurrent && license && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-cool">Tu plan</span>}
          {recommended && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs text-secondary">
              <Sparkles className="size-3" aria-hidden /> Recomendado
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground text-pretty">{plan.tagline}</p>
      </div>

      <div className="flex flex-col gap-2">
        {plan.perStudent && (
          <>
            <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-pretty text-cool">
              <strong className="text-gold">+{plan.seats} estudiantes:</strong> paga solo{" "}
              <strong className="text-foreground">{formatMxn(plan.priceMxn)}</strong> por estudiante al mes
            </p>
            <SeatStepper value={choice.seats} min={minSeats} onChange={setSeats} />
          </>
        )}
        {/* El total es el protagonista: en los planes por estudiante se recalcula con cada cambio. */}
        <p>
          <span className="text-4xl font-bold tabular-nums">{formatMxn(total)}</span>
          <span className="text-sm text-muted-foreground">/mes</span>
        </p>
        <p className="text-sm text-cool">
          Pagas {formatMxn(total)} al mes o <strong className="text-foreground tabular-nums">{formatMxn(annualPriceOf(choice))}</strong>{" "}
          por un año{" "}
          <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-secondary">
            {Math.round(ANNUAL_DISCOUNT * 100)} % de descuento
          </span>
        </p>
      </div>

      {saving > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-secondary/10 px-3 py-2 text-sm text-cool">
          <PiggyBank className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
          <span>
            Ahorras <strong className="text-foreground">{formatMxn(saving)} al mes</strong>
            {plan.perStudent
              ? ` (${formatMxn(TUTOR_PLANS.parent[0].priceMxn - plan.priceMxn)} por estudiante)`
              : ` frente a ${choice.seats} Planes Tutor`}
            .
          </span>
        </p>
      )}

      <ul className="flex flex-col gap-1.5 text-sm text-cool">
        {plan.perks.map((perk) => (
          <li key={perk} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden /> {perk}
          </li>
        ))}
      </ul>

      {/* Pago directo: el periodo se elige con el botón, sin pasos intermedios. */}
      {canChoose && (
        <div className="mt-auto flex flex-col gap-2">
          {isCurrent && license && (
            <p className="text-xs text-muted-foreground">
              Pasas de {license.seats} a {choice.seats} estudiantes; los actuales conservan su cupo.
            </p>
          )}
          <Button asChild variant="brand" className="h-auto min-h-11 py-2 whitespace-normal">
            <Link href={checkoutHref(choice, "mensual")}>
              <span className="flex flex-col items-center leading-tight">
                Pagar suscripción mensual
                <span className="text-xs font-medium opacity-90 tabular-nums">{formatMxn(total)} al mes</span>
              </span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto min-h-11 py-2 whitespace-normal">
            <Link href={checkoutHref(choice, "anual")}>
              <span className="flex flex-col items-center leading-tight">
                Pago anual
                <span className="text-xs font-medium text-secondary tabular-nums">
                  {formatMxn(annualPriceOf(choice))} por un año · ahorras {Math.round(ANNUAL_DISCOUNT * 100)} %
                </span>
              </span>
            </Link>
          </Button>
        </div>
      )}
    </li>
  );
}

function SeatStepper({ value, min, onChange }: { value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-sm text-muted-foreground">Estudiantes</span>
      <div className="flex items-center rounded-lg border">
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Un estudiante menos"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus />
        </Button>
        <output aria-live="polite" className="w-10 text-center font-bold tabular-nums">
          {value}
        </output>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Un estudiante más"
          disabled={value >= MAX_FAMILY_SEATS}
          onClick={() => onChange(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

/** Por qué el Plan Tutor cuesta más que el Plan Estudiante: lo que el padre gana además del acceso. */
function WhyTutor() {
  const points = [
    { icon: Sparkles, title: "Todo el acceso ilimitado", text: "Tu estudiante recibe los mismos beneficios del Plan Estudiante." },
    { icon: Eye, title: "Tú ves su avance", text: "Promedio, evolución semanal y materias a reforzar, en tu panel." },
    { icon: HeartHandshake, title: "Lo acompañas", text: "Reportes para WhatsApp y PDF para darle seguimiento juntos." },
  ];
  return (
    <aside className="relative overflow-hidden rounded-2xl border border-secondary/30 bg-card p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-secondary/15 blur-3xl" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow-secondary">
            <HeartHandshake className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-balance">Más que acceso: acompañamiento</h3>
            <p className="text-sm text-cool text-pretty">
              El Plan Tutor cuesta un poco más que el Plan Estudiante porque, además de extenderle a tu estudiante todos
              los beneficios del acceso ilimitado, te da el panel para monitorear su avance y ayudarle con su seguimiento.
            </p>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {points.map((p) => (
            <li key={p.title} className="flex gap-3 rounded-xl bg-muted/50 p-3">
              <p.icon className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{p.title}</p>
                <p className="text-muted-foreground text-pretty">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
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
