import { createClient } from "@supabase/supabase-js";

/**
 * Cliente único de Supabase (solo navegador). La sesión vive en localStorage para que
 * funcione igual en Vercel y en el export estático de Capacitor, donde no hay servidor.
 * Con `detectSessionInUrl` el cliente canjea solo el `?code=` que regresa de Google
 * o de los enlaces de correo.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local");
}

export const supabase = createClient(url, key, {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** URL absoluta de /auth/callback, a donde regresan Google y los correos de confirmación. */
export function authCallbackUrl(next?: string) {
  const base = `${window.location.origin}/auth/callback`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}
