/**
 * Modos del panel: cada modo es un "home" con sus herramientas. Quién puede cambiar de modo
 * se decide aquí, por rol y en código (MVP). La seguridad de los datos sigue siendo RLS.
 */

import type { LucideIcon } from "lucide-react";
import { GraduationCap, ShieldCheck, Users } from "lucide-react";

import type { Audience } from "@/lib/brand";

// Maestro y escuela (director) se definirán después del MVP.
export type Mode = "admin" | "student" | "parent";
export type UserType = "student" | "parent" | "teacher" | "director" | "admin";

export const MODES: Record<Mode, { label: string; description: string; home: string; icon: LucideIcon; audience: Audience }> = {
  admin: {
    label: "Admin",
    description: "Usuarios, licencias y banco de preguntas.",
    home: "/admin",
    icon: ShieldCheck,
    audience: "maestro",
  },
  student: {
    label: "Estudiante",
    description: "Exámenes, rachas y logros.",
    home: "/app/student",
    icon: GraduationCap,
    audience: "estudiante",
  },
  parent: {
    label: "Padre / Tutor",
    description: "Gestiona a tus estudiantes y sus licencias.",
    home: "/app/dashboard",
    icon: Users,
    audience: "maestro",
  },
};

/** Modo propio de cada rol. Maestro y director usan el home de padres hasta tener el suyo. */
export function ownMode(userType: UserType | null): Mode {
  if (userType === "admin") return "admin";
  if (userType === "student" || !userType) return "student";
  return "parent";
}

/**
 * Modos que el rol puede abrir con el botón de modo. Vacío = no ve el botón.
 * Futuro: director → ["director"] (solo sus herramientas).
 */
export function switchableModes(userType: UserType | null): Mode[] {
  return userType === "admin" ? ["admin", "student", "parent"] : [];
}

export function canViewMode(userType: UserType | null, mode: Mode) {
  return ownMode(userType) === mode || switchableModes(userType).includes(mode);
}

export const homePathFor = (userType: UserType | null) => MODES[ownMode(userType)].home;
