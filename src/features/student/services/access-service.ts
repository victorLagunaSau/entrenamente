/**
 * Suscripción del estudiante vía `get_my_access()` (licencia vigente por pago, cupón o permiso
 * del admin). Decide a qué home entra: Pro con acceso activo; Demo en cualquier otro caso.
 */

import type { AccessStatus } from "@/features/registro/types";
import { supabase } from "@/lib/supabase/client";

export type MyAccess = {
  status: AccessStatus;
  source: "stripe" | "coupon" | "admin" | null;
  expiresAt: string | null;
  sponsorAlias: string | null;
  freeExamsLeft: number;
};

export type StudentTier = "pro" | "demo";

export const STUDENT_HOMES: Record<StudentTier, string> = {
  pro: "/app/student/home",
  demo: "/app/student/home-demo",
};

export async function getMyAccess(): Promise<MyAccess> {
  const { data, error } = await supabase.rpc("get_my_access").single<{
    status: AccessStatus;
    source: MyAccess["source"];
    expires_at: string | null;
    sponsor_alias: string | null;
    free_exams_left: number;
  }>();
  if (error) throw error;

  return {
    status: data?.status ?? "inactive",
    source: data?.source ?? null,
    expiresAt: data?.expires_at ?? null,
    sponsorAlias: data?.sponsor_alias ?? null,
    freeExamsLeft: data?.free_exams_left ?? 0,
  };
}

/** Solo "active" es Pro; "free" (pruebas gratis) e "inactive" van al Demo. */
export const tierFor = (status: AccessStatus): StudentTier => (status === "active" ? "pro" : "demo");

export async function studentHomePath(): Promise<string> {
  return STUDENT_HOMES[tierFor((await getMyAccess()).status)];
}
