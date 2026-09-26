/**
 * Login y recuperación de contraseña con Supabase. El alta de cuentas vive en /registro.
 * Los componentes solo usan estas funciones; los mensajes de error ya vienen en español.
 */

import { authErrorMessage, type AuthResult } from "@/features/auth/services/auth-service";
import { authCallbackUrl, supabase } from "@/lib/supabase/client";

export { homePathForCurrentUser } from "@/features/auth/services/auth-service";

/** Ruta a la que regresa el correo de recuperación (vía /auth/callback). */
export const UPDATE_PASSWORD_PATH = "/login/nueva-contrasena";

export const PASSWORD_MIN = 8;

const normalize = (email: string) => email.trim().toLowerCase();

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email: normalize(email), password });
  return error ? { ok: false, error: authErrorMessage(error) } : { ok: true };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(normalize(email), {
    redirectTo: authCallbackUrl(UPDATE_PASSWORD_PATH),
  });
  return error ? { ok: false, error: authErrorMessage(error) } : { ok: true };
}

export async function updatePassword(password: string, confirm: string): Promise<AuthResult> {
  if (password.length < PASSWORD_MIN) return { ok: false, error: `Usa al menos ${PASSWORD_MIN} caracteres.` };
  if (password !== confirm) return { ok: false, error: "Las contraseñas no coinciden." };
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, error: authErrorMessage(error) } : { ok: true };
}

/** Solo rutas internas: evita redirecciones abiertas con ?next=https://… */
export const safeNext = (next: string | null | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : null;
