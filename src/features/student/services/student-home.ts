/**
 * Datos del home del estudiante, solo lo que hay en Supabase: carreras y récord de exámenes libres.
 * Planes y rachas aún no tienen tablas, así que arrancan vacíos (sin plan, racha por activar).
 */

import type { StudentCareer } from "./student-careers-service";

/** Examen libre ya presentado (resumen para el récord de la carrera). */
export type PastExam = {
  id: string;
  folio: string;
  /** Fecha y hora ISO en que se entregó. */
  date: string;
  level: "Fácil" | "Medio" | "Difícil";
  score: number;
};

export type HomeCareer = {
  id: string;
  name: string;
  universityId: string;
  universityShort: string;
  /** Avance del plan de estudios (0–100); null = aún no lo crea. */
  planProgress: number | null;
  /** Días seguidos de la racha; null = racha sin activar. */
  streakDays: number | null;
  /** Micro examen de hoy ya resuelto (se reinicia cada día). */
  streakDoneToday: boolean;
  /** Exámenes libres presentados, del más antiguo al más reciente. */
  exams: PastExam[];
};

/** `history`: exámenes libres reales por id de carrera (ver exam-record-service). */
export function getHomeCareers(careers: StudentCareer[], history: Map<string, PastExam[]>): HomeCareer[] {
  return careers.map((career) => ({
    ...career,
    planProgress: null,
    streakDays: null,
    streakDoneToday: false,
    exams: history.get(career.id) ?? [],
  }));
}
