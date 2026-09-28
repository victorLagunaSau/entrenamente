/**
 * Datos del home del estudiante, solo lo que hay en Supabase: carreras, récord de exámenes libres y rachas.
 * Los planes aún no tienen tablas, así que arrancan vacíos. La racha se activa al jugar la primera.
 */

import { diasDeRacha } from "@/features/exam/lib/racha";

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

/** `history`: exámenes libres por id de carrera; `rachas`: fechas de las rachas jugadas (ver exam-record-service). */
export function getHomeCareers(careers: StudentCareer[], history: Map<string, PastExam[]>, rachas: Map<string, string[]>): HomeCareer[] {
  return careers.map((career) => {
    const fechas = rachas.get(career.id);
    const racha = fechas ? diasDeRacha(fechas) : null;
    return {
      ...career,
      planProgress: null,
      streakDays: racha ? racha.dias : null,
      streakDoneToday: racha?.jugoHoy ?? false,
      exams: history.get(career.id) ?? [],
    };
  });
}
