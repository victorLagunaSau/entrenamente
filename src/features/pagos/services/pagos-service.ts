/** Llamadas del navegador a /api/stripe/* con el token de la sesión de Supabase. */

import { supabase } from "@/lib/supabase/client";

import type { CheckoutRequest, CheckoutResponse, SessionStatus } from "../lib/types";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(data.session ? { authorization: `Bearer ${data.session.access_token}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "No pudimos conectar con el pago. Intenta de nuevo.");
  return body as T;
}

export const checkout = (req: CheckoutRequest) =>
  call<CheckoutResponse>("/api/stripe/checkout", { method: "POST", body: JSON.stringify(req) });

export const sessionStatus = (id: string) => call<SessionStatus>(`/api/stripe/session?id=${encodeURIComponent(id)}`);

/** Portal de Stripe (tarjeta, facturas, cancelar la renovación). */
export async function openBillingPortal(returnPath: string) {
  const { url } = await call<{ url: string }>("/api/stripe/portal", {
    method: "POST",
    body: JSON.stringify({ returnPath }),
  });
  window.location.assign(url);
}

export type Renewal = {
  license_id: string;
  expires_at: string;
  days_left: number;
  auto_renew: boolean;
  source: "stripe" | "coupon" | "admin";
  plan_id: string | null;
  billing_cycle: string | null;
  seats: number | null;
  payment_method: "card" | "oxxo" | "spei" | null;
};

/** Licencia que paga el usuario (null si no tiene); para el aviso de renovación. */
export async function myRenewal(): Promise<Renewal | null> {
  const { data, error } = await supabase.rpc("mi_renovacion");
  if (error) throw error;
  return (data as Renewal | null) ?? null;
}
