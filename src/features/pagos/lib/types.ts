/** Tipos del pago compartidos entre la pantalla de pago y las rutas /api/stripe/*. */

import type { BillingInterval } from "@/features/pricing/lib/pricing";

/** card = tarjeta (se renueva sola); oxxo = efectivo; spei = transferencia. Los dos últimos pagan un solo periodo. */
export type PayMethod = "card" | "oxxo" | "spei";

/** Lo que debe cobrarse, calculado en Supabase (`stripe_cotizar`). */
export type Quote = {
  plan_id: string;
  plan_name: string;
  target_role: "student" | "parent";
  billing_cycle: BillingInterval;
  seats: number;
  per_student: boolean;
  quantity: number;
  unit_regular: number;
  unit_price: number;
  total: number;
  duration_days: number;
  assigned_variant: string | null;
  experiment_id: string | null;
  flash_sale_id: string | null;
  discount_pct: number | null;
  discount_kept: boolean;
  one_time_only: boolean;
  sale_title: string | null;
};

export type CheckoutRequest = {
  plan: string;
  periodo: BillingInterval;
  estudiantes?: number | null;
  oferta?: string | null;
  metodo?: PayMethod;
  /** true: solo cotiza (no abre el pago). */
  preview?: boolean;
};

export type CheckoutResponse =
  | { enabled: false }
  | { enabled: true; quote: Quote; clientSecret?: string; sessionId?: string };

/** Resultado de la sesión al cerrar el modal. */
export type SessionStatus = {
  /** open, complete o expired. */
  status: string;
  paid: boolean;
  method: PayMethod;
  /** OXXO: ficha para pagar en tienda. SPEI: instrucciones con la CLABE. */
  instructionsUrl: string | null;
  expiresAt: string | null;
};
