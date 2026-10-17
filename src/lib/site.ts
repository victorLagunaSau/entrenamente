import { Capacitor } from "@capacitor/core";

/** Dirección pública del sitio. Dominio oficial; se puede sobrescribir con NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.entrenamente.io").replace(/\/$/, "");

/**
 * Origen para los enlaces que salen de la app (invitaciones, correos de Supabase).
 * En la web es la página actual (localhost en desarrollo, Vercel en producción);
 * en la app de Capacitor la página corre desde el teléfono, así que se usa la pública.
 */
export const publicOrigin = () => (Capacitor.isNativePlatform() ? SITE_URL : window.location.origin);
