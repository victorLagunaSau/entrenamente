/**
 * Lecturas del panel del estudiante. RLS limita cada consulta a los datos del usuario;
 * aun así se filtra por su id porque padres y admins pueden ver otros perfiles.
 */

import { supabase } from "@/lib/supabase/client";

import { getMyAccess, type MyAccess } from "./access-service";

export type StudentSummary = {
  id: string;
  alias: string;
  fullName: string;
  goal: { universityId: string; careerId: string } | null;
  access: MyAccess;
};

export async function getStudentSummary(): Promise<StudentSummary | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const [profile, goal, access] = await Promise.all([
    supabase.from("profiles").select("alias, full_name").eq("id", userId).single(),
    supabase.from("student_goals").select("university_id, career_id").eq("user_id", userId).eq("is_initial", true).maybeSingle(),
    getMyAccess().catch((): MyAccess => ({
      status: "inactive",
      source: null,
      expiresAt: null,
      sponsorAlias: null,
      freeExamsLeft: 0,
    })),
  ]);
  if (profile.error || !profile.data) throw profile.error ?? new Error("Perfil no encontrado");

  return {
    id: userId,
    alias: profile.data.alias,
    fullName: profile.data.full_name,
    goal: goal.data ? { universityId: goal.data.university_id, careerId: goal.data.career_id } : null,
    access,
  };
}
