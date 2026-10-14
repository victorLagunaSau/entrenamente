"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/features/auth/hooks/use-session";

import { checkoutHref, signupHref, type PricingCatalog, type PricingRole, type PurchaseIntent, type Variant } from "../lib/pricing";
import { getPricingCatalog, resolveVariant, trackImpression, trackIntent } from "../services/pricing-service";

export type PricingState = {
  catalog: PricingCatalog | null;
  variant: Variant | null;
  error: boolean;
  loggedIn: boolean;
  /** Clic en "Pagar / Contratar": registra la intención y lleva al pago (o al registro sin sesión). */
  choose: (role: PricingRole, intent: PurchaseIntent) => void;
};

/** Catálogo + variante del usuario. `source` identifica la pantalla en la analítica (landing, pricing, home-demo…). */
export function usePricing(source: string): PricingState {
  const session = useSession();
  const router = useRouter();
  const loggedIn = !!session;
  // Solo importa quién está (el objeto de sesión cambia con cada renovación del token).
  const userKey = session === undefined ? undefined : (session?.user.id ?? null);
  const [catalog, setCatalog] = React.useState<PricingCatalog | null>(null);
  const [variant, setVariant] = React.useState<Variant | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (userKey === undefined) return;
    let active = true;
    Promise.all([getPricingCatalog(), resolveVariant(userKey)])
      .then(([c, v]) => {
        if (!active) return;
        setCatalog(c);
        setVariant(v);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [userKey]);

  const choose = React.useCallback(
    (role: PricingRole, intent: PurchaseIntent) => {
      if (variant) trackIntent({ role, variant, source }, intent, loggedIn);
      router.push(loggedIn ? checkoutHref(intent) : signupHref(role));
    },
    [variant, source, loggedIn, router]
  );

  return { catalog, variant, error, loggedIn, choose };
}

/** Registra una impresión por rol mostrado (una vez por montaje). */
export function useImpression(state: PricingState, role: PricingRole | null, source: string) {
  const seen = React.useRef(new Set<PricingRole>());
  React.useEffect(() => {
    if (!role || !state.catalog || !state.variant || seen.current.has(role)) return;
    seen.current.add(role);
    trackImpression({ role, variant: state.variant, source });
  }, [role, state.catalog, state.variant, source]);
}
