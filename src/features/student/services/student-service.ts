/**
 * Lecturas del panel del estudiante. RLS limita cada consulta a los datos del usuario;
 * aun así se filtra por su id porque padres y admins pueden ver otros perfiles.
 */

import type { AccessStatus } from "@/features/registro/types";
import { supabase } from "@/lib/supabase/client";

export type StudentSummary = {
  alias: string;
  fullName: string;
  goal: { universityId: string; careerId: string } | null;
  access: {
    status: AccessStatus;
    source: "stripe" | "coupon" | "admin" | null;
    expiresAt: string | null;
    sponsorAlias: string | null;
    freeExamsLeft: number;
  };
};

export async function getStudentSummary(): Promise<StudentSummary | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const [profile, goal, access] = await Promise.all([
    supabase.from("profiles").select("alias, full_name").eq("id", userId).single(),
    supabase.from("student_goals").select("university_id, career_id").eq("user_id", userId).eq("is_initial", true).maybeSingle(),
    supabase.rpc("get_my_access").single<{
      status: AccessStatus;
      source: StudentSummary["access"]["source"];
      expires_at: string | null;
      sponsor_alias: string | null;
      free_exams_left: number;
    }>(),
  ]);
  if (profile.error || !profile.data) throw profile.error ?? new Error("Perfil no encontrado");

  return {
    alias: profile.data.alias,
    fullName: profile.data.full_name,
    goal: goal.data ? { universityId: goal.data.university_id, careerId: goal.data.career_id } : null,
    access: {
      status: access.data?.status ?? "inactive",
      source: access.data?.source ?? null,
      expiresAt: access.data?.expires_at ?? null,
      sponsorAlias: access.data?.sponsor_alias ?? null,
      freeExamsLeft: access.data?.free_exams_left ?? 0,
    },
  };
}
