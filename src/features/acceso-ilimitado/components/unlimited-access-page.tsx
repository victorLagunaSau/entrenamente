"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarClock, CreditCard, Loader2, ShieldCheck, Users, Zap } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { annualPriceOf, priceOf } from "@/features/dashboard/lib/tutor-plans";
import { usePricing } from "@/features/pricing/hooks/use-pricing";
import {
  formatMxn,
  INTERVAL_LABEL,
  parentPlans,
  studentOffers,
  type BillingInterval,
  type PricingCatalog,
  type Variant,
} from "@/features/pricing/lib/pricing";

// El panel familiar usa "mensual"/"anual"; el motor de planes, los periodos de la base.
const PERIODS: Record<string, BillingInterval> = {
  mensual: "monthly",
  anual: "annual",
  monthly: "monthly",
  quarterly: "quarterly",
  annual: "annual",
};

type Summary = { planName: string; interval: BillingInterval; price: number; seats: number | null; sale: string | null };

/** Lo que va a pagar, recalculado con el catálogo y su variante (nunca con precios de la URL). */
function summarize(catalog: PricingCatalog, variant: Variant, params: URLSearchParams): Summary | null {
  const planId = params.get("plan");
  const interval = PERIODS[params.get("periodo") ?? "monthly"];
  const plan = catalog.plans.find((p) => p.id === planId);
  if (!plan || !interval) return null;

  const sale = catalog.flash_sales.find((f) => f.id === params.get("oferta") && f.plan_id === plan.id);
  if (sale) return { planName: plan.name, interval: sale.billing_cycle, price: sale.discounted_price, seats: null, sale: sale.title };

  if (plan.target_role === "student") {
    const offer = studentOffers(catalog, variant).find((o) => o.plan.id === plan.id && o.interval === interval);
    return offer ? { planName: plan.name, interval, price: offer.price, seats: null, sale: null } : null;
  }

  const tutorPlan = parentPlans(catalog).find((p) => p.id === plan.id);
  if (!tutorPlan || (interval !== "monthly" && interval !== "annual")) return null;
  const asked = Number(params.get("estudiantes")) || tutorPlan.seats;
  const seats = tutorPlan.perStudent ? Math.min(Math.max(asked, tutorPlan.seats), tutorPlan.maxSeats ?? 30) : tutorPlan.seats;
  const choice = { plan: tutorPlan, seats };
  return {
    planName: plan.name,
    interval,
    price: interval === "annual" ? annualPriceOf(choice) : priceOf(choice),
    seats,
    sale: null,
  };
}

/**
 * Pago del acceso ilimitado. Llega desde "Pagar / Contratar" (el clic ya quedó registrado como intención).
 * Fase previa a la pasarela: muestra el resumen; el cobro con Stripe / tiendas se conecta aquí después.
 */
export function UnlimitedAccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pricing = usePricing("checkout");
  const hasPlan = params.has("plan");

  React.useEffect(() => {
    if (!hasPlan) router.replace("/pricing");
  }, [hasPlan, router]);

  const summary = pricing.catalog && pricing.variant ? summarize(pricing.catalog, pricing.variant, params) : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link href="/pricing">
            <ArrowLeft /> Planes
          </Link>
        </Button>
      </div>

      <h1 className="text-3xl font-bold">Acceso ilimitado</h1>

      {!hasPlan || summary === undefined ? (
        pricing.error ? (
          <p role="alert" className="text-destructive">No pudimos cargar los planes. Recarga la página.</p>
        ) : (
          <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" aria-label="Cargando" />
        )
      ) : summary === null ? (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <p className="text-cool">Ese plan ya no está disponible.</p>
          <Button asChild variant="brand">
            <Link href="/pricing">Ver planes</Link>
          </Button>
        </div>
      ) : (
        <section aria-labelledby="resumen-title" className="flex flex-col gap-5 rounded-3xl border bg-card p-5 sm:p-7">
          <div>
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Resumen</p>
            <h2 id="resumen-title" className="text-2xl font-bold">
              {summary.planName}
            </h2>
            {summary.sale && (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-energy/15 px-2.5 py-0.5 text-xs font-semibold text-energy">
                <Zap className="size-3 fill-current" aria-hidden /> {summary.sale}
              </p>
            )}
          </div>
          <dl className="flex flex-col gap-3 text-sm">
            <Row icon={CalendarClock} label="Periodo" value={INTERVAL_LABEL[summary.interval].name} />
            {summary.seats && <Row icon={Users} label="Estudiantes" value={String(summary.seats)} />}
            <Row icon={CreditCard} label="Total" value={`${formatMxn(summary.price)} MXN / ${INTERVAL_LABEL[summary.interval].per}`} strong />
          </dl>
          <p className="flex gap-3 rounded-xl bg-secondary/10 p-4 text-sm text-cool">
            <ShieldCheck className="size-5 shrink-0 text-secondary" aria-hidden />
            <span>
              <strong className="text-foreground">El pago en línea se habilita muy pronto.</strong> Ya guardamos tu elección;
              te avisaremos en cuanto puedas completar tu compra.
            </span>
          </p>
          <Button variant="brand" size="lg" disabled>
            Pagar {formatMxn(summary.price)}
          </Button>
        </section>
      )}
    </main>
  );
}

function Row({ icon: Icon, label, value, strong }: { icon: typeof Users; label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-brand-light" aria-hidden />
      <dt className="flex-1 text-muted-foreground">{label}</dt>
      <dd className={strong ? "text-lg font-bold tabular-nums" : "font-medium"}>{value}</dd>
    </div>
  );
}
