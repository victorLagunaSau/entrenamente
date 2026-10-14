/**
 * Motor de planes: tipos del catálogo (`get_pricing_catalog`) y cálculo de lo que ve cada usuario según su rol
 * y su variante A/B. Los precios viven en Supabase (subscription_plans / ab_experiments / flash_sales) y el admin
 * los edita en /admin/revenue-analytics; aquí solo se derivan ofertas, ahorros y enlaces.
 */

import { TUTOR_PLANS, type TutorPlan } from "@/features/dashboard/lib/tutor-plans";

/** Por ahora solo se venden planes de Estudiantes y de Padres/Tutores. */
export type PricingRole = "student" | "parent";
export type Variant = "variant_a" | "variant_b";
export type BillingInterval = "monthly" | "quarterly" | "annual" | "one_time";

export type CatalogPlan = {
  id: string;
  target_role: PricingRole | "teacher" | "institution";
  name: string;
  description: string | null;
  base_price_monthly: number;
  base_price_annual: number | null;
  features: string[];
  min_students: number;
  max_students: number;
  extra_student_price_monthly: number;
  badge: string | null;
};

export type OfferConfig = { plan_id: string; interval: BillingInterval; price: number };
export type VariantConfig = { offers: OfferConfig[] };

export type Experiment = {
  id: string;
  name: string;
  target_role: PricingRole;
  variant_a: VariantConfig;
  variant_b: VariantConfig;
};

export type FlashSale = {
  id: string;
  title: string;
  target_role: PricingRole;
  plan_id: string;
  billing_cycle: BillingInterval;
  discounted_price: number;
  duration_days: number;
  starts_at: string;
  expires_at: string;
};

export type PricingCatalog = { plans: CatalogPlan[]; experiments: Experiment[]; flash_sales: FlashSale[] };

/**
 * Respaldo con los precios semilla de la migración 20261018000000: se usa solo si `get_pricing_catalog` falla
 * (p. ej. antes de correr la migración), para que la landing nunca se quede sin planes.
 */
export const FALLBACK_CATALOG: PricingCatalog = {
  plans: [
    {
      id: "student",
      target_role: "student",
      name: "Plan Estudiante",
      description: "Entrena sin límites hasta el día de tu examen.",
      base_price_monthly: 89,
      base_price_annual: 750,
      features: [
        "Exámenes ilimitados en todas tus carreras",
        "Modo Racha: mini-exámenes diarios de 10 minutos",
        "Plan de estudio con la fecha real de tu examen",
        "Guía de errores: cómo resolver cada pregunta que fallaste",
        "Agrega más de una carrera o universidad",
        "Estadísticas por examen y de tu avance general",
        "Reporte de cada examen con solución paso a paso, en PDF",
        "Simulacros con el tiempo y la apariencia de tu examen real",
      ],
      min_students: 1,
      max_students: 1,
      extra_student_price_monthly: 0,
      badge: null,
    },
    ...TUTOR_PLANS.parent.map((p): CatalogPlan => {
      // En los planes fijos priceMxn ya es el total; en el Familia es por estudiante.
      const monthly = p.perStudent ? p.priceMxn * p.seats : p.priceMxn;
      return {
        id: p.id,
        target_role: "parent",
        name: p.name,
        description: p.tagline,
        base_price_monthly: monthly,
        base_price_annual: Math.round(monthly * 12 * 0.8),
        features: p.perks,
        min_students: p.seats,
        max_students: p.perStudent ? 30 : p.seats,
        extra_student_price_monthly: p.perStudent ? p.priceMxn : 0,
        badge: p.badge ?? null,
      };
    }),
  ],
  experiments: [
    {
      id: "fallback",
      name: "Estudiantes: Mensual vs Trimestral",
      target_role: "student",
      variant_a: {
        offers: [
          { plan_id: "student", interval: "monthly", price: 89 },
          { plan_id: "student", interval: "annual", price: 750 },
        ],
      },
      variant_b: {
        offers: [
          { plan_id: "student", interval: "quarterly", price: 250 },
          { plan_id: "student", interval: "annual", price: 750 },
        ],
      },
    },
  ],
  flash_sales: [],
};

/** Una oferta lista para pintarse: plan + periodo + precio (+ ahorro frente al periodo más corto). */
export type Offer = {
  plan: CatalogPlan;
  interval: BillingInterval;
  price: number;
  /** % que se ahorra frente a pagar el periodo más corto de la misma variante durante el mismo tiempo. */
  savingsPct: number;
};

export const INTERVAL_MONTHS: Record<BillingInterval, number> = { monthly: 1, quarterly: 3, annual: 12, one_time: 1 };

export const INTERVAL_LABEL: Record<BillingInterval, { name: string; per: string; adverb: string }> = {
  monthly: { name: "Mensual", per: "mes", adverb: "Pago mensual" },
  quarterly: { name: "Trimestral", per: "trimestre", adverb: "Pago trimestral" },
  annual: { name: "Anual", per: "año", adverb: "Pago anual" },
  one_time: { name: "Pago único", per: "pago único", adverb: "Pago único" },
};

export const VARIANT_LABEL: Record<Variant, string> = { variant_a: "Variante A", variant_b: "Variante B" };

export const isVariant = (v: unknown): v is Variant => v === "variant_a" || v === "variant_b";

export const formatMxn = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: n % 1 === 0 ? 0 : 2 });

export const experimentFor = (catalog: PricingCatalog, role: PricingRole) =>
  catalog.experiments.find((e) => e.target_role === role) ?? null;

/**
 * Ofertas del Plan Estudiante para una variante. Sin experimento activo: mensual + anual con los precios base.
 * Variante A (semilla): $89/mes y $750/año (ahorras 30 %). Variante B: $250/trimestre y $750/año (ahorras 25 %).
 */
export function studentOffers(catalog: PricingCatalog, variant: Variant): Offer[] {
  const plans = new Map(catalog.plans.map((p) => [p.id, p]));
  const exp = experimentFor(catalog, "student");
  const configs: OfferConfig[] = exp
    ? exp[variant].offers
    : catalog.plans
        .filter((p) => p.target_role === "student")
        .slice(0, 1)
        .flatMap((p) => [
          { plan_id: p.id, interval: "monthly" as const, price: p.base_price_monthly },
          ...(p.base_price_annual ? [{ plan_id: p.id, interval: "annual" as const, price: p.base_price_annual }] : []),
        ]);

  const offers = configs.flatMap((c) => {
    const plan = plans.get(c.plan_id);
    return plan ? [{ plan, interval: c.interval, price: Number(c.price) }] : [];
  });
  // Referencia del ahorro: el precio mensual equivalente del periodo más corto.
  const ref = offers.reduce<{ months: number; monthly: number } | null>((best, o) => {
    const months = INTERVAL_MONTHS[o.interval];
    return !best || months < best.months ? { months, monthly: o.price / months } : best;
  }, null);
  return offers.map((o) => {
    const monthly = o.price / INTERVAL_MONTHS[o.interval];
    const savingsPct = ref && monthly < ref.monthly ? Math.round((1 - monthly / ref.monthly) * 100) : 0;
    return { ...o, savingsPct };
  });
}

/**
 * Planes de Padres/Tutores con los precios del catálogo, en el formato de las tarjetas del panel familiar.
 * Plan Familia: precio por estudiante = extra_student_price_monthly y mínimo = min_students ($225 = 3 × $75).
 */
export function parentPlans(catalog: PricingCatalog | null): TutorPlan[] {
  const rows = catalog?.plans.filter((p) => p.target_role === "parent") ?? [];
  if (rows.length === 0) return TUTOR_PLANS.parent;
  return rows.map((p) => {
    const perStudent = p.max_students > p.min_students && p.extra_student_price_monthly > 0;
    const monthlyBase = Number(p.base_price_monthly);
    const annual = p.base_price_annual == null ? null : Number(p.base_price_annual);
    return {
      id: p.id,
      name: p.name,
      tagline: p.description ?? "",
      seats: p.min_students,
      maxSeats: p.max_students,
      perStudent,
      priceMxn: perStudent ? Number(p.extra_student_price_monthly) : monthlyBase,
      perks: p.features,
      badge: p.badge ?? undefined,
      annualDiscount: annual && monthlyBase > 0 ? Math.max(0, 1 - annual / (monthlyBase * 12)) : undefined,
    };
  });
}

export const activeFlashSales = (catalog: PricingCatalog, role: PricingRole, now = Date.now()) =>
  catalog.flash_sales.filter(
    (f) => f.target_role === role && new Date(f.starts_at).getTime() <= now && now <= new Date(f.expires_at).getTime()
  );

/** Precio regular de referencia de una oferta flash (para tacharlo). */
export function regularPriceOf(catalog: PricingCatalog, sale: FlashSale): number | null {
  const plan = catalog.plans.find((p) => p.id === sale.plan_id);
  if (!plan) return null;
  if (sale.billing_cycle === "annual") return plan.base_price_annual ?? plan.base_price_monthly * 12;
  return plan.base_price_monthly * INTERVAL_MONTHS[sale.billing_cycle];
}

/** Lo que el usuario quiere comprar (clic de intención). */
export type PurchaseIntent = { planId: string; interval: BillingInterval; seats?: number; saleId?: string };

/** Pantalla de pago (con sesión). */
export function checkoutHref({ planId, interval, seats, saleId }: PurchaseIntent) {
  const q = new URLSearchParams({ plan: planId, periodo: interval });
  if (seats) q.set("estudiantes", String(seats));
  if (saleId) q.set("oferta", saleId);
  return `/acceso-ilimitado?${q}`;
}

/** Registro (sin sesión) con el perfil que corresponde al plan. */
export const signupHref = (role: PricingRole) => `/registro?perfil=${role === "parent" ? "tutor" : "estudiante"}`;
