/**
 * Carreras del alumno: sus metas en `student_goals` (la inicial primero) con nombre y sigla del catálogo
 * oficial de Supabase. Si una meta ya no está en el catálogo, se toma del catálogo del registro.
 */

import { findCareer, findUniversity } from "@/features/registro/data/catalog";
import { supabase } from "@/lib/supabase/client";

export type StudentCareer = {
  id: string;
  name: string;
  universityId: string;
  universityShort: string;
};

type CareerRow = { id: string; nombre: string; institucion_id: string; instituciones: { clave: string } | null };

export async function getStudentCareers(studentId: string): Promise<StudentCareer[]> {
  const goals = await supabase
    .from("student_goals")
    .select("university_id, career_id")
    .eq("user_id", studentId)
    .order("is_initial", { ascending: false })
    .order("created_at", { ascending: true });
  if (goals.error) throw goals.error;
  if (goals.data.length === 0) return [];

  const catalog = await supabase
    .from("carreras")
    .select("id, nombre, institucion_id, instituciones(clave)")
    .in(
      "id",
      goals.data.map((g) => g.career_id)
    );
  if (catalog.error) throw catalog.error;
  const official = new Map((catalog.data as unknown as CareerRow[]).map((c) => [c.id, c]));

  return goals.data.flatMap((g): StudentCareer[] => {
    const c = official.get(g.career_id);
    if (c)
      return [
        {
          id: c.id,
          name: c.nombre,
          universityId: c.institucion_id,
          universityShort: c.instituciones?.clave ?? c.institucion_id.toUpperCase(),
        },
      ];
    const university = findUniversity(g.university_id);
    const career = findCareer(g.university_id, g.career_id);
    return university && career
      ? [{ id: career.id, name: career.name, universityId: university.id, universityShort: university.short }]
      : [];
  });
}
