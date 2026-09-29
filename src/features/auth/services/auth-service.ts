/**
 * Sesión de Supabase compartida por los módulos: mensajes de error en español, cierre de
 * sesión y panel de destino. El login vive en features/login y el alta en features/registro.
 */

import type { AuthError } from "@supabase/supabase-js";

import { homePathFor, ownMode } from "@/features/modes/modes";
import { studentHomePath } from "@/features/student/services/access-service";
import { supabase } from "@/lib/supabase/client";

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

export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Panel al que entra cada tipo de usuario tras iniciar sesión. Admin → /admin; estudiante →
 * home Pro o Demo según su suscripción; padres/maestros → su dashboard.
 */
export async function homePathForCurrentUser(): Promise<string> {
  // Filtrar por el propio id: padres y admins también pueden leer otros perfiles (RLS).
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return homePathFor(null);
  const { data } = await supabase.from("profiles").select("user_type").eq("id", auth.user.id).maybeSingle();
  const userType = data?.user_type ?? null;
  if (ownMode(userType) === "student") return studentHomePath().catch(() => homePathFor(userType));
  return homePathFor(userType);
}
