/**
 * Ingresos y A/B testing (/admin/revenue-analytics). Todo pasa por funciones `admin_*` de la base
 * (migración 20261018000000_planes_ab_testing), que validan que quien llama sea administrador.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import type { UserType } from "@/features/modes/modes";
import type { BillingInterval, PricingRole, Variant, VariantConfig } from "@/features/pricing/lib/pricing";
import { supabase } from "@/lib/supabase/client";

export class RevenueError extends Error {}

function fail(error: PostgrestError): never {
  if (error.code === "PGRST202") {
    throw new RevenueError("A la base de datos le falta la migración de planes (20261018000000_planes_ab_testing).");
  }
  throw new RevenueError(error.message);
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) fail(error);
  return data as T;
}

export type AdminPlan = {
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
  sort_order: number;
  is_active: boolean;
};

export type ExperimentStatus = "active" | "paused" | "finished";

export type AdminExperiment = {
  id: string;
  experiment_name: string;
  target_role: PricingRole;
  variant_a_config: VariantConfig;
  variant_b_config: VariantConfig;
  status: ExperimentStatus;
  created_at: string;
};

export type AdminFlashSale = {
  id: string;
  title: string;
  target_role: PricingRole;
  /** null = todos los planes del rol (solo ofertas por porcentaje). */
  plan_id: string | null;
  billing_cycle: BillingInterval;
  discounted_price: number | null;
  discount_pct: number | null;
  /** null = los días del periodo que compre. */
  duration_days: number | null;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
};

export type PricingAdmin = { plans: AdminPlan[]; experiments: AdminExperiment[]; flash_sales: AdminFlashSale[] };

export type VariantMetrics = {
  variant: Variant;
  impressions: number;
  /** Vistas mientras había una oferta en curso (migración 20261022000000; 0 antes de correrla). */
  impressions_offer?: number;
  visitors: number;
  click_intents: number;
  click_intents_offer?: number;
  registrations: number;
  receipts: number;
  receipts_offer?: number;
  /** Total = normal + oferta. */
  revenue: number;
  revenue_offer?: number;
  revenue_normal?: number;
  by_plan: Record<string, number>;
  by_plan_offer?: Record<string, number>;
  mobile_share: number | null;
};

/** Ventas (recibos no reembolsados) de un plan, periodo y variante. */
export type PlanSales = {
  plan_id: string;
  billing_cycle: BillingInterval;
  variant: Variant | null;
  receipts: number;
  receipts_offer: number;
  revenue: number;
  revenue_offer: number;
  revenue_normal: number;
};

export type AbMetrics = {
  experiment: AdminExperiment | null;
  variants: VariantMetrics[];
  assigned?: Record<Variant, number>;
};

export type Receipt = {
  id: string;
  receipt_code: string;
  user_id: string;
  plan_id: string;
  plan_name: string | null;
  license_id: string | null;
  assigned_variant: Variant | null;
  seats: number;
  amount_paid: number;
  currency: string;
  billing_cycle: BillingInterval;
  duration_days: number;
  license_starts_at: string;
  license_expires_at: string;
  status: "active" | "expired" | "refunded";
  notes: string | null;
  created_at: string;
  vigente: boolean;
  /** admin = emitido a mano; stripe = pagado en línea. */
  payment_provider: "admin" | "stripe";
  payment_method: "card" | "oxxo" | "spei" | null;
  auto_renew: boolean;
  stripe_checkout_session_id: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  sale_title: string | null;
  discount_pct: number | null;
  user: { id: string; alias: string; email: string; full_name: string; user_type: UserType } | null;
};

export const getPricingAdmin = () => rpc<PricingAdmin>("admin_precios");

export const getAbMetrics = (experimentId: string | null) =>
  rpc<AbMetrics>("admin_metricas_ab", { p_experiment: experimentId });

/** Sin la migración 20261022000000 regresa [] para que la pestaña de planes siga funcionando. */
export const getPlanSales = () =>
  rpc<PlanSales[]>("admin_ventas_planes").catch((e: unknown) => {
    if (e instanceof RevenueError && /admin_ventas_planes|migración/.test(e.message)) return [];
    throw e;
  });

export const savePlan = (p: AdminPlan) =>
  rpc<void>("admin_guardar_plan", {
    p_id: p.id,
    p_name: p.name,
    p_description: p.description,
    p_monthly: p.base_price_monthly,
    p_annual: p.base_price_annual,
    p_extra: p.extra_student_price_monthly,
    p_features: p.features,
    p_badge: p.badge,
    p_active: p.is_active,
  });

export const saveExperiment = (e: { id: string | null; name: string; role: PricingRole; a: VariantConfig; b: VariantConfig }) =>
  rpc<string>("admin_guardar_experimento", { p_id: e.id, p_name: e.name, p_role: e.role, p_a: e.a, p_b: e.b });

export const setExperimentStatus = (id: string, status: ExperimentStatus) =>
  rpc<void>("admin_estado_experimento", { p_id: id, p_status: status });

/** Precio fijo: planId + cycle + price. Porcentaje: pct (+ planId opcional; sin plan = todo el rol). */
export type FlashSaleInput = {
  id: string | null;
  title: string;
  role: PricingRole;
  planId: string | null;
  cycle: BillingInterval;
  price: number | null;
  pct: number | null;
  durationDays: number | null;
  startsAt: string;
  expiresAt: string;
  active: boolean;
};

export const saveFlashSale = (f: FlashSaleInput) =>
  rpc<string>("admin_guardar_oferta", {
    p_id: f.id,
    p_title: f.title,
    p_role: f.role,
    p_plan: f.planId,
    p_cycle: f.cycle,
    p_price: f.price,
    p_pct: f.pct,
    p_duration_days: f.durationDays,
    p_starts_at: f.startsAt,
    p_expires_at: f.expiresAt,
    p_active: f.active,
  });

export const setFlashSaleActive = (id: string, active: boolean) =>
  rpc<void>("admin_estado_oferta", { p_id: id, p_active: active });

export const searchReceipts = (q: string) => rpc<Receipt[]>("admin_buscar_recibos", { p_q: q });

export const issueReceipt = (r: {
  userId: string;
  planId: string;
  cycle: BillingInterval;
  seats: number | null;
  amount: number | null;
  saleId: string | null;
  notes: string;
}) =>
  rpc<Receipt>("admin_emitir_recibo", {
    p_user: r.userId,
    p_plan: r.planId,
    p_ciclo: r.cycle,
    p_estudiantes: r.seats,
    p_monto: r.amount,
    p_oferta: r.saleId,
    p_notas: r.notes,
  });

export const extendReceipt = (id: string, days: number) => rpc<Receipt>("admin_extender_recibo", { p_id: id, p_dias: days });

export const setReceiptStatus = (id: string, status: "active" | "refunded") =>
  rpc<Receipt>("admin_estado_recibo", { p_id: id, p_status: status });

/** Tasa segura (0 si no hay base). */
export const rate = (num: number, den: number) => (den > 0 ? num / den : 0);

export const pct = (x: number) => `${(x * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })} %`;

/**
 * Ganadora: la de mayor ingreso por visitante (retorno); si no hay ingresos aún, la de mayor tasa de intención
 * (clics / impresiones). Null si no hay datos o empatan.
 */
export function winnerOf(variants: VariantMetrics[]): { variant: Variant; reason: string } | null {
  if (variants.length < 2) return null;
  const [a, b] = variants;
  const rev = (v: VariantMetrics) => rate(v.revenue, v.visitors || v.impressions);
  const ctr = (v: VariantMetrics) => rate(v.click_intents, v.impressions);
  if (a.revenue + b.revenue > 0 && rev(a) !== rev(b)) {
    return { variant: rev(a) > rev(b) ? a.variant : b.variant, reason: "Mayor ingreso por visitante" };
  }
  if (a.impressions + b.impressions > 0 && ctr(a) !== ctr(b)) {
    return { variant: ctr(a) > ctr(b) ? a.variant : b.variant, reason: "Mayor intención de compra (CTR)" };
  }
  return null;
}
