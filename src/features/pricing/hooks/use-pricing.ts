"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/features/auth/hooks/use-session";
import { getViewer } from "@/features/modes/services/viewer-service";

import { checkoutHref, signupHref, type PricingCatalog, type PricingRole, type PurchaseIntent, type Variant } from "../lib/pricing";
import { getPricingCatalog, resolveVariant, trackImpression, trackIntent } from "../services/pricing-service";

export type PricingState = {
  catalog: PricingCatalog | null;
  /** Variante con la que se pintan los precios: la del usuario o, para el admin, la que eligió revisar. */
  variant: Variant | null;
  error: boolean;
  loggedIn: boolean;
  /** Solo el admin puede alternar entre las variantes A y B (vista previa; su variante real no cambia). */
  isAdmin: boolean;
  /** Ya se sabe si cuenta para la analítica (el admin no cuenta). */
  trackable: boolean;
  setPreview: (variant: Variant) => void;
  /** Clic en "Pagar / Contratar": registra la intención y lleva al pago (o al registro sin sesión). */
  choose: (role: PricingRole, intent: PurchaseIntent) => void;
};

/* Vista previa del admin compartida por todas las pantallas abiertas (home + modal), sin persistir. */
let previewVariant: Variant | null = null;
const previewListeners = new Set<() => void>();
const subscribePreview = (fn: () => void) => {
  previewListeners.add(fn);
  return () => previewListeners.delete(fn);
};
const getPreview = () => previewVariant;
function setPreviewVariant(v: Variant) {
  previewVariant = v;
  previewListeners.forEach((fn) => fn());
}

/** Catálogo + variante del usuario. `source` identifica la pantalla en la analítica (landing, pricing, home-demo…). */
export function usePricing(source: string): PricingState {
  const session = useSession();
  const router = useRouter();
  const loggedIn = !!session;
  // Solo importa quién está (el objeto de sesión cambia con cada renovación del token).
  const userKey = session === undefined ? undefined : (session?.user.id ?? null);
  const [catalog, setCatalog] = React.useState<PricingCatalog | null>(null);
  const [variant, setVariant] = React.useState<Variant | null>(null);
  // null: aún no se sabe si quien está es admin.
  const [admin, setAdmin] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState(false);
  const preview = React.useSyncExternalStore(subscribePreview, getPreview, () => null);

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
    if (userKey) {
      getViewer()
        .then((v) => active && setAdmin(v?.userType === "admin"))
        .catch(() => active && setAdmin(false));
    } else {
      setAdmin(false);
    }
    return () => {
      active = false;
    };
  }, [userKey]);

  const isAdmin = admin === true;
  const trackable = admin === false;
  const shown = isAdmin && preview ? preview : variant;

  const choose = React.useCallback(
    (role: PricingRole, intent: PurchaseIntent) => {
      // El admin no cuenta en la analítica del experimento.
      if (shown && trackable) trackIntent({ role, variant: shown, source }, intent, loggedIn);
      router.push(loggedIn ? checkoutHref(intent) : signupHref(role));
    },
    [shown, trackable, source, loggedIn, router]
  );

  return { catalog, variant: shown, error, loggedIn, isAdmin, trackable, setPreview: setPreviewVariant, choose };
}

/** Registra una impresión por rol mostrado (una vez por montaje). El admin no cuenta. */
export function useImpression(state: PricingState, role: PricingRole | null, source: string) {
  const seen = React.useRef(new Set<PricingRole>());
  React.useEffect(() => {
    if (!role || !state.catalog || !state.variant || !state.trackable || seen.current.has(role)) return;
    seen.current.add(role);
    trackImpression({ role, variant: state.variant, source });
  }, [role, state.catalog, state.variant, state.trackable, source]);
}
