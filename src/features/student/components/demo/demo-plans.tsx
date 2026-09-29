import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarRange, Check, CreditCard, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatMxn, monthlyOfYearly } from "../../services/demo-service";

export type Prices = { monthly: number; yearly: number };

type PlanId = "mensual" | "anual";

/** Lo que incluye el Plan Estudiante (todo existe o está en camino en la plataforma). */
const INCLUDED = [
  "Exámenes ilimitados en todas tus carreras",
  "Modo Racha: mini-exámenes diarios de 10 minutos",
  "Plan de estudio con la fecha real de tu examen",
  "Guías de estudio de las materias que se te dificultan",
  "Agrega más de una carrera o universidad",
  "Estadísticas por examen y de tu avance general",
  "Reporte de cada examen con solución paso a paso, en PDF",
  "Simulacros con el tiempo y la apariencia de tu examen real",
];

type Plan = {
  id: PlanId;
  icon: LucideIcon;
  name: string;
  tagline: string;
  price: string;
  period: string;
  priceNote: string;
  badge?: string;
  featuresTitle: string;
  features: string[];
  featured: boolean;
};

function plansFor(prices: Prices): Plan[] {
  const saving = Math.round((prices.monthly * 12 - prices.yearly) * 100) / 100;
  return [
    {
      id: "mensual",
      icon: CreditCard,
      name: "Mensual",
      tagline: "Entrena sin límites, mes a mes",
      price: formatMxn(prices.monthly),
      period: "MXN / mes",
      priceNote: "Pago mensual.",
      featuresTitle: "Incluye:",
      features: INCLUDED,
      featured: false,
    },
    {
      id: "anual",
      icon: CalendarRange,
      name: "Anual",
      tagline: "Todo tu ciclo de admisión, en un solo pago",
      price: formatMxn(prices.yearly),
      period: "MXN / año",
      priceNote: `Equivale a ${formatMxn(monthlyOfYearly(prices.yearly))} MXN al mes. Un solo pago al año.`,
      badge: saving > 0 ? `Ahorras ${formatMxn(saving)}` : "Mejor opción",
      featuresTitle: "Todo lo del plan Mensual, más:",
      features: [
        "Un solo pago: te olvidas de pagar cada mes",
        "12 meses de práctica sin restricciones",
        ...(saving > 0 ? [`Ahorras ${formatMxn(saving)} MXN frente al plan Mensual`] : []),
      ],
      featured: true,
    },
  ];
}

/** Sección "Planes": dos ofertas del Plan Estudiante con precio, llamado a la acción y beneficios. */
export function PlansSection({ prices }: { prices: Prices }) {
  return (
    <section id="planes" aria-labelledby="planes-title" className="flex scroll-mt-20 flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-bold tracking-widest text-secondary uppercase">Planes</p>
        <h2 id="planes-title" className="font-display text-3xl font-extrabold text-balance sm:text-4xl">
          Elige tu Plan Estudiante
        </h2>
        <p className="max-w-xl text-cool text-pretty">Todo lo que necesitas para llegar listo a tu examen de admisión.</p>
      </div>
      <StudentPlans prices={prices} />
    </section>
  );
}

/** Tarjetas de los planes. `compact` (modal): apiladas y sin la lista de beneficios. */
export function StudentPlans({ prices, compact = false }: { prices: Prices; compact?: boolean }) {
  return (
    <div className={cn("grid gap-5", !compact && "lg:grid-cols-2 lg:items-stretch")}>
      {plansFor(prices).map((plan) => (
        <PlanCard key={plan.id} plan={plan} compact={compact} />
      ))}
    </div>
  );
}

function PlanCard({ plan, compact }: { plan: Plan; compact: boolean }) {
  const Icon = plan.icon;
  return (
    <article className={cn("relative rounded-3xl p-px", plan.featured ? "bg-gradient-to-b from-energy via-energy/40 to-border" : "bg-border")}>
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-energy px-3 py-1 text-xs font-bold whitespace-nowrap text-background shadow-glow-energy">
          {plan.badge}
        </span>
      )}
      <div className={cn("flex h-full flex-col rounded-[calc(1.5rem-1px)] bg-card", compact ? "gap-3 p-5" : "gap-5 p-6 sm:p-8")}>
        {!compact && (
          <span
            className={cn(
              "grid size-12 place-items-center rounded-2xl",
              plan.featured ? "bg-energy/15 text-energy" : "bg-brand-gradient text-white shadow-glow-secondary"
            )}
          >
            <Icon className="size-6" aria-hidden />
          </span>
        )}
        <div>
          <h3 className={cn("font-display font-bold", compact ? "text-xl" : "text-3xl")}>{plan.name}</h3>
          <p className="text-cool">{plan.tagline}</p>
        </div>
        <div>
          <p className={cn("font-display font-extrabold tabular-nums", compact ? "text-4xl" : "text-5xl")}>
            {plan.price}
            <span className="text-base font-medium text-muted-foreground"> {plan.period}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{plan.priceNote}</p>
        </div>
        <Button asChild size="lg" variant={plan.featured ? "energy" : "brand"} className="h-12 w-full">
          <Link href={`/acceso-ilimitado?plan=${plan.id}`}>
            <Rocket /> Pagar ahora
          </Link>
        </Button>
        {!compact && (
          <div className="flex flex-col gap-3 border-t pt-5">
            <p className="text-sm font-semibold">{plan.featuresTitle}</p>
            <ul className="flex flex-col gap-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-cool">
                  <Check className={cn("mt-0.5 size-4 shrink-0", plan.featured ? "text-energy" : "text-secondary")} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
