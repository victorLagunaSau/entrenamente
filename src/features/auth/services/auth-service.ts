/**
 * Autenticación con Supabase: correo/contraseña, Google y recuperación de contraseña.
 * Los componentes solo usan estas funciones; los mensajes de error ya vienen en español.
 */

import type { AuthError } from "@supabase/supabase-js";

import { authCallbackUrl, supabase } from "@/lib/supabase/client";

export type AuthResult = { ok: true } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.",
  over_email_send_rate_limit: "Enviamos demasiados correos. Espera unos minutos e intenta de nuevo.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
  weak_password: "La contraseña es muy débil. Usa al menos 8 caracteres.",
  same_password: "La nueva contraseña debe ser distinta a la anterior.",
  user_already_exists: "Este correo ya tiene una cuenta. Inicia sesión.",
  email_address_invalid: "Revisa tu correo electrónico.",
};

export function authErrorMessage(error: AuthError | null | undefined) {
  return (error?.code && MESSAGES[error.code]) || "Algo salió mal. Intenta de nuevo.";
}

const result = (error: AuthError | null): AuthResult =>
  error ? { ok: false, error: authErrorMessage(error) } : { ok: true };

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return result(error);
}

/** Redirige a Google; al volver, /auth/callback termina el inicio de sesión. */
export async function signInWithGoogle(next?: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authCallbackUrl(next), queryParams: { prompt: "select_account" } },
  });
  return result(error);
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: authCallbackUrl("/auth?mode=update"),
  });
  return result(error);
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password });
  return result(error);
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Panel al que entra cada tipo de usuario tras iniciar sesión. */
export async function homePathForCurrentUser(): Promise<string> {
  const { data } = await supabase.from("profiles").select("user_type").maybeSingle();
  return data?.user_type === "student" || !data ? "/app/student" : "/app/dashboard";
}
