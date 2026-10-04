import { Capacitor } from "@capacitor/core";

/** Dirección pública del sitio. Cambiarla aquí (o con NEXT_PUBLIC_SITE_URL) al tener dominio propio. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://entrenamente.vercel.app").replace(/\/$/, "");

/**
 * Origen para los enlaces que salen de la app (invitaciones, correos de Supabase).
 * En la web es la página actual (localhost en desarrollo, Vercel en producción);
 * en la app de Capacitor la página corre desde el teléfono, así que se usa la pública.
 */
export const publicOrigin = () => (Capacitor.isNativePlatform() ? SITE_URL : window.location.origin);
