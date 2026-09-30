/**
 * Administración de usuarios y licencias (/admin/users). Todo pasa por funciones `admin_*` de la base,
 * que validan que quien llama sea administrador.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import type { UserType } from "@/features/modes/modes";
import type { LicensePlan } from "@/features/dashboard/services/tutor-service";
import { supabase } from "@/lib/supabase/client";

export class AdminUsersError extends Error {}

function fail(error: PostgrestError): never {
  if (error.code === "PGRST202") {
    throw new AdminUsersError("A la base de datos le falta la migración de usuarios (20260929050000_admin_usuarios).");
  }
  throw new AdminUsersError(error.message);
}

export const USER_TYPES: { value: UserType; label: string }[] = [
  { value: "student", label: "Estudiante" },
  { value: "parent", label: "Padre / Tutor" },
  { value: "teacher", label: "Maestro" },
  { value: "director", label: "Escuela / Director" },
  { value: "admin", label: "Administrador" },
];

export const userTypeLabel = (t: UserType) => USER_TYPES.find((u) => u.value === t)?.label ?? t;

/** Tipos de licencia de la base, con el nombre comercial que ve cada tipo de usuario. */
export const LICENSE_PLANS: { value: LicensePlan; label: string; seats: number }[] = [
  { value: "individual", label: "Individual · Plan Estudiante o Plan Tutor", seats: 1 },
  { value: "family_2", label: "Plan Dúo · 2 estudiantes", seats: 2 },
  { value: "family_5", label: "Plan Familia · 3 o más", seats: 3 },
  { value: "school", label: "Escuela / Docente", seats: 20 },
  { value: "promo", label: "Promocional", seats: 1 },
];

export const planLabel = (p: LicensePlan) => LICENSE_PLANS.find((l) => l.value === p)?.label.split(" · ")[0] ?? p;

export const SOURCE_LABEL: Record<AdminLicense["source"], string> = {
  stripe: "Pago",
  coupon: "Cupón",
  admin: "Cortesía (admin)",
};

type Person = { id: string; alias: string; email: string };

export type UserHit = Person & {
  full_name: string;
  user_type: UserType;
  created_at: string;
  acceso: { plan: LicensePlan; expires_at: string; propia: boolean } | null;
};

export type AdminLicense = {
  id: string;
  plan: LicensePlan;
  seats: number;
  source: "stripe" | "coupon" | "admin";
  status: "active" | "inactive";
  starts_at: string;
  expires_at: string;
  vigente: boolean;
  granted_reason: string | null;
  coupon_code: string | null;
  ocupados: (Person & { full_name: string })[];
};

export type AdminUser = Person & {
  full_name: string;
  user_type: UserType;
  created_at: string;
  ultimo_acceso: string | null;
  estudiante: { free_exams_used: number; free_exams_granted: number; free_trial_ends_at: string } | null;
  examenes: number;
  licencias: AdminLicense[];
  lugar: { license_id: string; plan: LicensePlan; expires_at: string; vigente: boolean; dueno: Person } | null;
  tutores: (Person & { user_type: UserType })[];
  estudiantes: Person[];
};

export async function searchUsers(q: string): Promise<UserHit[]> {
  if (q.trim().length < 3) throw new AdminUsersError("Escribe al menos 3 letras del correo, nombre o ID.");
  const { data, error } = await supabase.rpc("admin_buscar_usuarios", { p_q: q.trim() });
  if (error) fail(error);
  return (data ?? []) as UserHit[];
}

export async function getUser(id: string): Promise<AdminUser> {
  const { data, error } = await supabase.rpc("admin_usuario", { p_id: id });
  if (error) fail(error);
  return data as AdminUser;
}

export async function changeUserType(id: string, type: UserType): Promise<void> {
  const { error } = await supabase.rpc("admin_cambiar_tipo_usuario", { p_id: id, p_tipo: type });
  if (error) fail(error);
}

export type GrantInput = { plan: LicensePlan; seats: number; days: number; reason: string };

export async function grantLicense(ownerId: string, input: GrantInput): Promise<void> {
  const { error } = await supabase.rpc("admin_otorgar_licencia", {
    p_owner: ownerId,
    p_plan: input.plan,
    p_seats: input.seats,
    p_dias: input.days,
    p_motivo: input.reason,
  });
  if (error) fail(error);
}

export type LicenseEdit = { plan: LicensePlan; seats: number; expiresAt: string; status: AdminLicense["status"]; reason: string };

export async function updateLicense(id: string, input: LicenseEdit): Promise<void> {
  const { error } = await supabase.rpc("admin_editar_licencia", {
    p_id: id,
    p_plan: input.plan,
    p_seats: input.seats,
    p_expires_at: input.expiresAt,
    p_status: input.status,
    p_motivo: input.reason,
  });
  if (error) fail(error);
}

export async function deleteLicense(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_borrar_licencia", { p_id: id });
  if (error) fail(error);
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_borrar_usuario", { p_id: id });
  if (error) fail(error);
}

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
