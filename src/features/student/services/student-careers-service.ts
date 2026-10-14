/**
 * Carreras del alumno: sus metas en `student_goals` (la inicial primero) con nombre y sigla del catálogo
 * compartido (features/catalogo, sin consultas extra si ya se leyó). Las que salieron del catálogo no se muestran.
 */

import { getCatalogoActivo } from "@/features/catalogo";
import { supabase } from "@/lib/supabase/client";

export type StudentCareer = {
  id: string;
  name: string;
  universityId: string;
  universityShort: string;
};

export async function getStudentCareers(studentId: string): Promise<StudentCareer[]> {
  const goals = await supabase
    .from("student_goals")
    .select("university_id, career_id")
    .eq("user_id", studentId)
    .order("is_initial", { ascending: false })
    .order("created_at", { ascending: true });
  if (goals.error) throw goals.error;
  if (goals.data.length === 0) return [];

  const catalogo = await getCatalogoActivo();
  const official = new Map(
    catalogo.flatMap((i) => i.carreras.map((c) => [c.id, { id: c.id, name: c.nombre, universityId: i.id, universityShort: i.sigla }] as const))
  );
  return goals.data.flatMap((g): StudentCareer[] => {
    const c = official.get(g.career_id);
    return c ? [c] : [];
  });
}
