"use client";

import { RolePlans } from "@/features/pricing/components/pricing-plans";
import type { PricingState } from "@/features/pricing/hooks/use-pricing";
import { formatMxn, INTERVAL_LABEL, INTERVAL_MONTHS, studentOffers } from "@/features/pricing/lib/pricing";

/**
 * Precio corto del Plan Estudiante para los letreros ("$89 MXN / mes" o "$250 MXN / trimestre"): la oferta de
 * periodo más corto de la variante A/B del alumno. Null mientras carga el catálogo.
 */
export function priceHeadline(pricing: PricingState): string | null {
  if (!pricing.catalog || !pricing.variant) return null;
  const offers = studentOffers(pricing.catalog, pricing.variant);
  const first = [...offers].sort((a, b) => INTERVAL_MONTHS[a.interval] - INTERVAL_MONTHS[b.interval])[0];
  return first ? `${formatMxn(first.price)} MXN / ${INTERVAL_LABEL[first.interval].per}` : null;
}

/** Sección "Planes": las ofertas del Plan Estudiante que le tocan al alumno (motor de planes + A/B). */
export function PlansSection({ pricing }: { pricing: PricingState }) {
  return (
    <section id="planes" aria-labelledby="planes-title" className="flex scroll-mt-20 flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-bold tracking-widest text-secondary uppercase">Planes</p>
        <h2 id="planes-title" className="font-display text-3xl font-extrabold text-balance sm:text-4xl">
          Elige tu Plan Estudiante
        </h2>
        <p className="max-w-xl text-cool text-pretty">Todo lo que necesitas para llegar listo a tu examen de admisión.</p>
      </div>
      {pricing.catalog ? (
        <RolePlans pricing={pricing} role="student" />
      ) : (
        <div className="h-72 animate-pulse rounded-3xl bg-card motion-reduce:animate-none" aria-label="Cargando planes" />
      )}
    </section>
  );
}

/** Tarjetas compactas del modal de planes. */
export function StudentPlans({ pricing }: { pricing: PricingState }) {
  return pricing.catalog ? (
    <RolePlans pricing={pricing} role="student" compact />
  ) : (
    <div className="h-48 animate-pulse rounded-3xl bg-card motion-reduce:animate-none" aria-label="Cargando planes" />
  );
}
