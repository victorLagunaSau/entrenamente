/**
 * Datos simulados del home del estudiante (solo visual). La meta inicial viene de Supabase;
 * la segunda carrera, los planes y las rachas son de ejemplo hasta definir su lógica.
 */

import { findCareer, findUniversity } from "@/features/registro/data/catalog";

export type HomeCareer = {
  id: string;
  name: string;
  universityId: string;
  universityShort: string;
  /** Avance del plan de estudios (0–100); null = aún no lo crea. */
  planProgress: number | null;
  /** Días seguidos de la racha; null = racha sin activar. */
  streakDays: number | null;
};

const EXAMPLE_EXTRA = { universityId: "uam", careerId: "uam-diseno" };

export function getHomeCareers(goal: { universityId: string; careerId: string } | null): HomeCareer[] {
  const goals = [goal, EXAMPLE_EXTRA].filter((g): g is NonNullable<typeof g> => g !== null);
  const seen = new Set<string>();

  return goals.flatMap((g, i) => {
    const university = findUniversity(g.universityId);
    const career = findCareer(g.universityId, g.careerId);
    if (!university || !career || seen.has(career.id)) return [];
    seen.add(career.id);
    return [
      {
        id: career.id,
        name: career.name,
        universityId: university.id,
        universityShort: university.short,
        planProgress: i === 0 ? 35 : null,
        streakDays: i === 0 ? 4 : null,
      },
    ];
  });
}
