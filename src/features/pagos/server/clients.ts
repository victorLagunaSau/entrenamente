/**
 * Clientes del servidor (rutas /api/stripe/*). Nunca se importan desde el navegador: usan claves secretas.
 *   · STRIPE_SECRET_KEY      sk_test_… (sandbox) / sk_live_… o rk_live_… (real)
 *   · SUPABASE_SECRET_KEY    clave secreta (service role) de Supabase: llama a las funciones stripe_*
 */

import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let stripeClient: Stripe | null = null;
let adminClient: SupabaseClient | null = null;

export class ConfigError extends Error {}

/** Stripe se configura con claves de entorno; sin ellas el pago en línea queda apagado. */
export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SECRET_KEY);

/**
 * true con claves reales (sk_live_/rk_live_), false con las de la sandbox. Localhost usa la sandbox y producción la
 * cuenta real, pero comparten Supabase: los clientes de Stripe se guardan por modo y cada recibo dice el suyo.
 */
export const stripeLive = () => /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new ConfigError("Falta STRIPE_SECRET_KEY.");
  stripeClient ??= new Stripe(key, { appInfo: { name: "entrenamente" } });
  return stripeClient;
}

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new ConfigError("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.");
  adminClient ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
}

/** Usuario de la petición a partir de su token de Supabase (`Authorization: Bearer …`). */
export async function userFromRequest(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  return error ? null : data.user;
}
