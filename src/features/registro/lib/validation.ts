import type { AccountData, Flow, GoalData } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export const PASSWORD_MIN = 8;

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string };

/** 0–4: longitud, mayúsculas+minúsculas, número y símbolo. */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= PASSWORD_MIN) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < PASSWORD_MIN) score = Math.min(score, 1);
  const labels = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"] as const;
  return { score: score as PasswordStrength["score"], label: labels[score] };
}

export function validateAccount(a: AccountData, flow: Flow): FieldErrors<AccountData> {
  const e: FieldErrors<AccountData> = {};
  const name = a.fullName.trim();
  if (!name) e.fullName = "Escribe tu nombre para conocerte.";
  else if (name.split(/\s+/).length < 2) e.fullName = "Incluye al menos un nombre y un apellido.";

  // Alias opcional: si queda vacío saludamos con el primer nombre.
  const alias = a.alias.trim();
  if (flow !== "parent" && alias) {
    if (alias.length < 2 || alias.length > 20) e.alias = "Usa entre 2 y 20 caracteres.";
    else if (!/^[\p{L}\p{N} _.-]+$/u.test(alias)) e.alias = "Usa solo letras, números y espacios.";
  }

  if (!a.email.trim()) e.email = "Escribe tu correo electrónico.";
  else if (!EMAIL_RE.test(a.email.trim())) e.email = "Revisa el formato del correo (tu@correo.com).";

  if (!a.password) e.password = "Crea una contraseña.";
  else if (/\s/.test(a.password)) e.password = "La contraseña no puede tener espacios.";
  else if (a.password.length < PASSWORD_MIN) e.password = `Usa al menos ${PASSWORD_MIN} caracteres.`;
  else if (!/[A-Za-z]/.test(a.password) || !/\d/.test(a.password))
    e.password = "Combina letras y al menos un número.";

  return e;
}

export function validateGoal(g: GoalData): FieldErrors<GoalData> {
  const e: FieldErrors<GoalData> = {};
  if (!g.universityId) e.universityId = "Elige una institución.";
  if (!g.careerId) e.careerId = "Elige una carrera.";
  return e;
}
