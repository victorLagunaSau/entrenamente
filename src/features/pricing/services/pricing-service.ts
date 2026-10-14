/**
 * Catálogo de precios, variante A/B y eventos del embudo.
 *
 * Variante: aleatoria 50/50 la primera vez y fija para siempre.
 *   · Visitante: se guarda en localStorage (`examente_pricing_variant`) y viaja en los metadatos del registro.
 *   · Con sesión: manda la del perfil (`asignar_variante_precio` la fija una sola vez en el servidor).
 *   · Las ofertas flash nunca la cambian.
 * Todo falla en silencio: la analítica nunca debe impedir ver los planes ni comprar.
 */

import { supabase } from "@/lib/supabase/client";

import { FALLBACK_CATALOG, isVariant, type PricingCatalog, type PricingRole, type PurchaseIntent, type Variant } from "../lib/pricing";

const VARIANT_KEY = "examente_pricing_variant";
const VISITOR_KEY = "examente_visitor_id";
const INTENT_KEY = "examente_pricing_intent";
const SYNCED_KEY = "examente_pricing_synced";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Navegación privada o almacenamiento bloqueado: se sigue sin persistir.
  }
}

export const deviceType = (): "mobile" | "desktop" =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";

/** Id anónimo del navegador para unir sus eventos con la cuenta cuando se registre. */
export function visitorId(): string {
  let id = read(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    write(VISITOR_KEY, id);
  }
  return id;
}

/** Variante del navegador; si no hay, la sortea 50/50 y la guarda. */
export function localVariant(): Variant {
  const saved = read(VARIANT_KEY);
  if (isVariant(saved)) return saved;
  const variant: Variant = Math.random() < 0.5 ? "variant_a" : "variant_b";
  write(VARIANT_KEY, variant);
  return variant;
}

/** Último plan en el que el visitante hizo clic (para contar el registro como conversión). */
export const pendingIntent = (): string | null => read(INTENT_KEY);

/** Metadatos que el registro manda en `auth.signUp` para grabar la variante en el perfil nuevo. */
export function signupPricingMetadata(): Record<string, string | null> {
  return {
    pricing_variant: localVariant(),
    pricing_visitor_id: visitorId(),
    pricing_intent_plan: pendingIntent(),
    pricing_device: deviceType(),
  };
}

let catalogPromise: Promise<PricingCatalog> | null = null;

/** Catálogo público (una llamada por sesión de navegador). Si la base falla, los precios semilla. */
export function getPricingCatalog(): Promise<PricingCatalog> {
  catalogPromise ??= (async () => {
    const { data, error } = await supabase.rpc("get_pricing_catalog");
    if (error || !data) {
      console.warn("[pricing] catálogo no disponible, uso el de respaldo:", error?.message);
      catalogPromise = null;
      return FALLBACK_CATALOG;
    }
    return data as PricingCatalog;
  })();
  return catalogPromise;
}

let resolved: { userId: string; promise: Promise<Variant> } | null = null;

/**
 * Variante definitiva del usuario. Con sesión la fija el servidor (respetando la que ya vio como visitante)
 * y se copia al navegador para que no cambie al cerrar sesión. Una llamada por usuario y carga de página.
 */
export function resolveVariant(userId: string | null): Promise<Variant> {
  const local = localVariant();
  if (!userId) return Promise.resolve(local);
  if (resolved?.userId === userId) return resolved.promise;
  const promise = (async () => {
    const { data, error } = await supabase.rpc("asignar_variante_precio", {
      p_variant: local,
      p_visitor: visitorId(),
      p_intent_plan: pendingIntent(),
      p_device: deviceType(),
    });
    if (error || !isVariant(data)) return local;
    write(VARIANT_KEY, data);
    write(INTENT_KEY, null);
    write(SYNCED_KEY, "1");
    return data;
  })().catch(() => local);
  resolved = { userId, promise };
  return promise;
}

/** Al entrar a la plataforma: graba la variante en el perfil una sola vez por navegador. */
export function syncVariantOnce(userId: string) {
  if (read(SYNCED_KEY)) return;
  void resolveVariant(userId);
}

type EventInput = { role: PricingRole; variant: Variant; source: string };

function track(event: "impression" | "click_intent", { role, variant, source }: EventInput, intent?: PurchaseIntent) {
  void supabase
    .rpc("registrar_evento_precio", {
      p_event: event,
      p_variant: variant,
      p_role: role,
      p_plan: intent?.planId ?? null,
      p_cycle: intent?.interval ?? null,
      p_device: deviceType(),
      p_visitor: visitorId(),
      p_source: source,
    })
    .then(({ error }) => error && console.warn("[pricing] evento no registrado:", error.message));
}

export const trackImpression = (input: EventInput) => track("impression", input);

/** Clic en "Pagar / Contratar". Sin sesión deja guardado el plan para contar el registro como conversión. */
export function trackIntent(input: EventInput, intent: PurchaseIntent, loggedIn: boolean) {
  track("click_intent", input, intent);
  if (!loggedIn) write(INTENT_KEY, intent.planId);
}
