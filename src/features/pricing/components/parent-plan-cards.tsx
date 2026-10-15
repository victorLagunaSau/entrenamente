"use client";

import * as React from "react";
import { Check, Eye, HeartHandshake, Minus, PiggyBank, Plus, Sparkles, Star, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  annualDiscountPct,
  annualPriceOf,
  formatMxn,
  priceOf,
  salePriceOf,
  type BillingPeriod,
  type PlanChoice,
  type TutorPlan,
} from "@/features/dashboard/lib/tutor-plans";
import type { TutorLicense } from "@/features/dashboard/services/tutor-service";
import { cn } from "@/lib/utils";

import { percentSaleFor, type FlashSale } from "../lib/pricing";

// Tope del selector del Plan Familia cuando el plan no trae el suyo.
const MAX_FAMILY_SEATS = 6;

/** Ahorro mensual frente a pagar el plan de 1 estudiante (el primero de la lista) por cada uno. */
export function savingsVs(plans: TutorPlan[], choice: PlanChoice): number {
  const single = plans.find((p) => !p.perStudent && p.seats === 1);
  return single ? Math.max(single.priceMxn * choice.seats - priceOf(choice), 0) : 0;
}

/** `sale`: la oferta por porcentaje que aplica a ese plan (para mandarla al pago). */
export type ChooseHandler = (choice: PlanChoice, period: BillingPeriod, sale: FlashSale | null) => void;

/** Rejilla de planes de Padres/Tutores: Tutor, Dúo y Familia (calculadora). */
export function ParentPlanGrid({
  plans,
  onChoose,
  license = null,
  currentId,
  recommendedId,
  showSavings = true,
  sales = [],
}: {
  plans: TutorPlan[];
  /** Ofertas vigentes del rol; las de porcentaje se aplican a las tarjetas. */
  sales?: FlashSale[];
  onChoose: ChooseHandler;
  license?: TutorLicense | null;
  currentId?: string;
  recommendedId?: string;
  /** El ahorro frente al Plan Tutor solo tiene sentido en planes familiares (no en los docentes). */
  showSavings?: boolean;
}) {
  return (
    <ul className={cn("grid gap-3", plans.length === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2")}>
      {plans.map((p) => (
        <ParentPlanCard
          key={p.id}
          plan={p}
          plans={showSavings ? plans : []}
          license={license}
          isCurrent={currentId === p.id}
          recommended={recommendedId === p.id && currentId !== p.id}
          sale={percentSaleFor(sales, p.id)}
          onChoose={onChoose}
        />
      ))}
    </ul>
  );
}

export function ParentPlanCard({
  plan,
  plans,
  license,
  isCurrent,
  recommended,
  sale = null,
  onChoose,
}: {
  plan: TutorPlan;
  plans: TutorPlan[];
  license: TutorLicense | null;
  isCurrent: boolean;
  recommended: boolean;
  sale?: FlashSale | null;
  onChoose: ChooseHandler;
}) {
  // Plan por estudiante: por defecto uno más de los que ya tiene (nunca menos del mínimo del plan).
  const minSeats = plan.perStudent ? Math.max(plan.seats, isCurrent && license ? license.seats + 1 : plan.seats) : plan.seats;
  const [seats, setSeats] = React.useState(minSeats);
  const choice: PlanChoice = { plan, seats: plan.perStudent ? Math.max(seats, minSeats) : plan.seats };
  const total = priceOf(choice);
  const annual = annualPriceOf(choice);
  const pct = sale?.discount_pct ?? null;
  // Con oferta, lo que paga (redondeado por unidad, como en Stripe).
  const payMonthly = pct ? salePriceOf(choice, "mensual", pct) : total;
  const payAnnual = pct ? salePriceOf(choice, "anual", pct) : annual;
  const saving = savingsVs(plans, choice);
  const single = plans.find((p) => !p.perStudent && p.seats === 1);
  const discount = annualDiscountPct(plan);
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
              <strong className="text-gold">De {plan.seats} a {plan.maxSeats ?? MAX_FAMILY_SEATS} estudiantes:</strong> paga solo{" "}
              <strong className="text-foreground">{formatMxn(pct ? salePriceOf({ plan, seats: 1 }, "mensual", pct) : plan.priceMxn)}</strong>{" "}
              por estudiante al mes
              {pct && <span className="text-muted-foreground line-through"> {formatMxn(plan.priceMxn)}</span>}
            </p>
            <SeatStepper value={choice.seats} min={minSeats} max={plan.maxSeats ?? MAX_FAMILY_SEATS} onChange={setSeats} />
          </>
        )}
        {pct && (
          <p className="inline-flex w-fit items-center gap-1 rounded-full bg-energy/15 px-2.5 py-0.5 text-xs font-bold text-energy">
            <Zap className="size-3 fill-current" aria-hidden /> {Math.round(pct)} % de descuento por tiempo limitado
          </p>
        )}
        {/* El total es el protagonista: en los planes por estudiante se recalcula con cada cambio. */}
        <p>
          <span className="text-4xl font-bold tabular-nums">{formatMxn(payMonthly)}</span>
          <span className="text-sm text-muted-foreground">/mes</span>
          {pct && <span className="ml-2 text-base text-muted-foreground line-through tabular-nums">{formatMxn(total)}</span>}
        </p>
        <p className="text-sm text-cool">
          Pagas {formatMxn(payMonthly)} al mes o <strong className="text-foreground tabular-nums">{formatMxn(payAnnual)}</strong>{" "}
          por un año
          {pct && <span className="text-muted-foreground line-through tabular-nums"> {formatMxn(annual)}</span>}{" "}
          {discount > 0 && (
            <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-secondary">
              {discount} % de descuento
            </span>
          )}
        </p>
      </div>

      {saving > 0 && single && (
        <p className="flex items-start gap-2 rounded-lg bg-secondary/10 px-3 py-2 text-sm text-cool">
          <PiggyBank className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
          <span>
            Ahorras <strong className="text-foreground">{formatMxn(saving)} al mes</strong>
            {plan.perStudent
              ? ` (${formatMxn(single.priceMxn - plan.priceMxn)} por estudiante)`
              : ` frente a ${choice.seats} ${single.name.replace(/^Plan /, "Planes ")}`}
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
          <Button variant="brand" className="h-auto min-h-11 py-2 whitespace-normal" onClick={() => onChoose(choice, "mensual", sale)}>
            <span className="flex flex-col items-center leading-tight">
              Pagar suscripción mensual
              <span className="text-xs font-medium opacity-90 tabular-nums">{formatMxn(payMonthly)} al mes</span>
            </span>
          </Button>
          <Button variant="outline" className="h-auto min-h-11 py-2 whitespace-normal" onClick={() => onChoose(choice, "anual", sale)}>
            <span className="flex flex-col items-center leading-tight">
              Pago anual
              <span className="text-xs font-medium text-secondary tabular-nums">
                {formatMxn(payAnnual)} por un año{discount > 0 && ` · ahorras ${discount} %`}
              </span>
            </span>
          </Button>
        </div>
      )}
    </li>
  );
}

function SeatStepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
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
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

/** Por qué el Plan Tutor cuesta más que el Plan Estudiante: lo que el padre gana además del acceso. */
export function WhyTutor() {
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
