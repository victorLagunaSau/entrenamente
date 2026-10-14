import { PricingPlans } from "@/features/pricing/components/pricing-plans";

import { SectionHeading } from "./section-heading";

/** Planes y precios (motor de planes con A/B testing). Por ahora solo Estudiantes y Padres/Tutores. */
export function Plans() {
  return (
    <section id="planes" aria-labelledby="planes-title" className="reveal mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading
        id="planes-title"
        eyebrow="Planes"
        title={
          <>
            Entrenamiento a la medida para <span className="text-brand-gradient">estudiantes y familias</span>
          </>
        }
      />
      <div className="mt-14">
        <PricingPlans source="landing" />
      </div>
    </section>
  );
}
