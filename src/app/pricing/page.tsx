import type { Metadata } from "next";

import { Footer } from "@/features/landing/components/footer";
import { Navbar } from "@/features/landing/components/navbar";
import { SectionHeading } from "@/features/landing/components/section-heading";
import { PricingPlans } from "@/features/pricing/components/pricing-plans";

export const metadata: Metadata = {
  title: "Planes y precios",
  description: "Planes de Entrena Mente para estudiantes y para padres y tutores.",
};

/** Vista pública de planes. Con sesión, cada quien ve solo los planes de su rol. */
export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pt-28 pb-20 sm:px-6 sm:pt-32">
        <SectionHeading
          id="pricing-title"
          eyebrow="Planes"
          title={
            <>
              Entrena sin límites hasta el <span className="text-brand-gradient">día de tu examen</span>
            </>
          }
        />
        <div id="planes" className="mt-12 scroll-mt-28">
          <PricingPlans source="pricing" />
        </div>
      </main>
      <Footer />
    </>
  );
}
