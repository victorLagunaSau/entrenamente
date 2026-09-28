/**
 * Récord de exámenes libres del home: lee `exam_history` (RLS: solo las filas del alumno).
 * Solo columnas de resumen; la "fotografía" del examen (frozen_exam_data) se queda en la base.
 */

import { supabase } from "@/lib/supabase/client";

import type { PastExam } from "./student-home";

const LEVELS: Record<string, PastExam["level"]> = { facil: "Fácil", media: "Medio", dificil: "Difícil" };

type Row = {
  id: number;
  folio: string;
  career_id: string | null;
  level: string;
  score_achieved: number | string;
  max_score: number | string;
  completed_at: string;
};

/** Exámenes libres por carrera, del más antiguo al más reciente. */
export async function getFreeExamHistory(studentId: string): Promise<Map<string, PastExam[]>> {
  const { data, error } = await supabase
    .from("exam_history")
    .select("id, folio, career_id, level, score_achieved, max_score, completed_at")
    .eq("student_id", studentId)
    .eq("exam_type", "libre")
    .order("completed_at", { ascending: true });
  if (error) throw error;

  const byCareer = new Map<string, PastExam[]>();
  for (const r of data as Row[]) {
    if (!r.career_id) continue;
    const max = Number(r.max_score);
    const exam: PastExam = {
      id: String(r.id),
      folio: r.folio,
      date: r.completed_at,
      level: LEVELS[r.level] ?? "Medio",
      score: max > 0 ? Math.round((Number(r.score_achieved) / max) * 100) : 0,
    };
    byCareer.set(r.career_id, [...(byCareer.get(r.career_id) ?? []), exam]);
  }
  return byCareer;
}

/** Guía de estudio guardada: una por examen libre (fallas por materia con diagnóstico y solución, en su reporte). */
export type StudyGuide = PastExam & {
  careerId: string | null;
  careerName: string;
  universityId: string;
  universityShort: string;
  /** Preguntas para repasar: incorrectas, parciales y sin responder. */
  toReview: number;
  /** Materias con fallas, de la más débil a la más fuerte. */
  weakSubjects: string[];
};

type Subject = { materia: string; total: number; correctas: number; porcentaje_aciertos: number };

/** Todas las guías del alumno, de la más reciente a la más antigua. */
export async function getStudyGuides(studentId: string): Promise<StudyGuide[]> {
  const { data, error } = await supabase
    .from("exam_history")
    .select(
      "id, folio, career_id, career_name, university_key, level, score_achieved, max_score, completed_at, materias:frozen_exam_data->resumen_por_materia"
    )
    .eq("student_id", studentId)
    .eq("exam_type", "libre")
    .order("completed_at", { ascending: false });
  if (error) throw error;

  return (data as unknown as (Row & { career_name: string; university_key: string; materias: Subject[] | null })[]).map((r) => {
    const subjects = (r.materias ?? []).filter((m) => m.correctas < m.total);
    const max = Number(r.max_score);
    return {
      id: String(r.id),
      folio: r.folio,
      date: r.completed_at,
      level: LEVELS[r.level] ?? "Medio",
      score: max > 0 ? Math.round((Number(r.score_achieved) / max) * 100) : 0,
      careerId: r.career_id,
      careerName: r.career_name,
      universityId: r.university_key.toLowerCase(),
      universityShort: r.university_key,
      toReview: subjects.reduce((n, m) => n + m.total - m.correctas, 0),
      weakSubjects: [...subjects].sort((a, b) => a.porcentaje_aciertos - b.porcentaje_aciertos).map((m) => m.materia),
    };
  });
}

/** Fechas de las rachas jugadas por carrera (para contar los días seguidos). */
export async function getRachaHistory(studentId: string): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from("exam_history")
    .select("career_id, completed_at")
    .eq("student_id", studentId)
    .eq("exam_type", "racha");
  if (error) throw error;

  const byCareer = new Map<string, string[]>();
  for (const r of data as { career_id: string | null; completed_at: string }[]) {
    if (r.career_id) byCareer.set(r.career_id, [...(byCareer.get(r.career_id) ?? []), r.completed_at]);
  }
  return byCareer;
}
