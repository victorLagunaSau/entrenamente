"use client";

import * as React from "react";
import { CircleAlert, GraduationCap, HeartHandshake } from "lucide-react";

import { getViewer } from "@/features/modes/services/viewer-service";
import { cn } from "@/lib/utils";

import { useImpression, usePricing, type PricingState } from "../hooks/use-pricing";
import { activeFlashSales, parentPlans, studentOffers, type PricingRole } from "../lib/pricing";
import { FlashSaleBanner } from "./flash-sale-banner";
import { ParentPlanGrid, WhyTutor } from "./parent-plan-cards";
import { StudentOfferCards } from "./student-plan-cards";

const TABS: { role: PricingRole; label: string; icon: typeof GraduationCap }[] = [
  { role: "student", label: "Estudiantes", icon: GraduationCap },
  { role: "parent", label: "Padres y tutores", icon: HeartHandshake },
];

/**
 * Planes públicos (landing y /pricing). Visitantes: pestañas Estudiantes / Padres y tutores.
 * Con sesión solo se ven los del propio rol (el admin ve ambos).
 */
export function PricingPlans({ source, initialRole = "student" }: { source: string; initialRole?: PricingRole }) {
  const pricing = usePricing(source);
  const [allowed, setAllowed] = React.useState<PricingRole[] | null>(null);
  const [role, setRole] = React.useState<PricingRole>(initialRole);

  React.useEffect(() => {
    if (!pricing.loggedIn) {
      setAllowed(["student", "parent"]);
      return;
    }
    let active = true;
    getViewer()
      .then((v) => {
        if (!active) return;
        const only: PricingRole[] =
          !v || v.userType === "admin" ? ["student", "parent"] : v.userType === "student" ? ["student"] : ["parent"];
        setAllowed(only);
        if (only.length === 1) setRole(only[0]);
      })
      .catch(() => active && setAllowed(["student", "parent"]));
    return () => {
      active = false;
    };
  }, [pricing.loggedIn]);

  const shown = allowed?.includes(role) ? role : null;
  useImpression(pricing, shown, source);

  if (pricing.error) {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="size-4 shrink-0" /> No pudimos cargar los planes. Recarga la página.
      </p>
    );
  }
  if (!pricing.catalog || !pricing.variant || !allowed || !shown) {
    return <div className="h-96 animate-pulse rounded-3xl bg-card motion-reduce:animate-none" aria-label="Cargando planes" />;
  }

  return (
    <div className="flex flex-col gap-8">
      {allowed.length > 1 && (
        <div role="tablist" aria-label="Tipo de plan" className="mx-auto flex w-full max-w-md rounded-full border bg-card p-1">
          {TABS.map(({ role: r, label, icon: Icon }) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={shown === r}
              onClick={() => setRole(r)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                shown === r ? "bg-brand-gradient text-white shadow-glow-secondary" : "text-cool hover:text-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      )}
      <RolePlans pricing={pricing} role={shown} />
    </div>
  );
}

/** Ofertas flash vigentes + planes de un rol, con los precios de la variante del usuario. */
export function RolePlans({ pricing, role, compact = false }: { pricing: PricingState; role: PricingRole; compact?: boolean }) {
  const { catalog, variant, choose } = pricing;
  if (!catalog || !variant) return null;
  const sales = activeFlashSales(catalog, role);

  return (
    <div className="flex flex-col gap-6">
      {sales.map((sale) => (
        <FlashSaleBanner
          key={sale.id}
          catalog={catalog}
          sale={sale}
          onChoose={(s) => choose(role, { planId: s.plan_id, interval: s.billing_cycle, saleId: s.id })}
        />
      ))}
      {role === "student" ? (
        <StudentOfferCards
          offers={studentOffers(catalog, variant)}
          compact={compact}
          onChoose={(o) => choose("student", { planId: o.plan.id, interval: o.interval })}
        />
      ) : (
        <>
          {!compact && <WhyTutor />}
          <ParentPlanGrid
            plans={parentPlans(catalog)}
            onChoose={({ plan, seats }, period) =>
              choose("parent", { planId: plan.id, interval: period === "anual" ? "annual" : "monthly", seats })
            }
          />
        </>
      )}
    </div>
  );
}
