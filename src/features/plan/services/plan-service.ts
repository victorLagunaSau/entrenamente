/**
 * Examen Plan en Supabase (migración 20260928010000_examen_plan.sql). El alumno solo lee sus tablas;
 * crear, reagendar, cancelar, armar y calificar pasan por funciones que validan en la base.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import type { ExamItem, MateriaSummary, Nivel } from "@/features/exam/lib/libre";
import { type AnswerSheet, ExamenError } from "@/features/exam/services/libre-service";
import type { Dificultad } from "@/features/exam/types";
import { supabase } from "@/lib/supabase/client";

import type { PlanDraft, PlanSession, StudentPlan } from "../lib/plan";

function fail(error: PostgrestError): never {
  if (error.code === "PGRST202" || error.code === "PGRST205" || error.code === "42P01")
    throw new ExamenError("El plan de estudios aún no está instalado en la base de datos.");
  throw new ExamenError(error.message);
}

type ExamRow = { id: number; folio: string; level: Nivel; score_achieved: number | string; max_score: number | string; completed_at: string };

type PlanRow = {
  id: number;
  career_id: string;
  university_key: string;
  career_name: string;
  official_exam_date: string;
  practice_days: StudentPlan["practiceDays"];
  exams_per_day: number;
  difficulty_mode: StudentPlan["difficultyMode"];
  fixed_difficulty_level: Nivel | null;
  preferred_time_window: string;
  created_at: string;
  plan_sessions: {
    id: number;
    scheduled_date: string;
    kind: PlanSession["kind"];
    status: PlanSession["status"];
    exam: ExamRow | null;
  }[];
};

const pct = (score: number | string, max: number | string) => (Number(max) > 0 ? Math.round((Number(score) / Number(max)) * 100) : 0);

/** Planes activos del alumno con su calendario y la calificación de cada examen presentado. */
export async function getMyPlans(): Promise<StudentPlan[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("student_plans")
    .select(
      "id, career_id, university_key, career_name, official_exam_date, practice_days, exams_per_day, difficulty_mode, fixed_difficulty_level, preferred_time_window, created_at, plan_sessions(id, scheduled_date, kind, status, exam:exam_history(id, folio, level, score_achieved, max_score, completed_at))"
    )
    .eq("student_id", auth.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .order("scheduled_date", { referencedTable: "plan_sessions", ascending: true })
    .order("id", { referencedTable: "plan_sessions", ascending: true });
  if (error) fail(error);

  return (data as unknown as PlanRow[]).map((p) => ({
    id: p.id,
    careerId: p.career_id,
    universityKey: p.university_key,
    careerName: p.career_name,
    officialDate: p.official_exam_date,
    practiceDays: p.practice_days,
    examsPerDay: p.exams_per_day,
    difficultyMode: p.difficulty_mode,
    fixedLevel: p.fixed_difficulty_level,
    timeWindow: p.preferred_time_window,
    createdAt: p.created_at,
    sessions: p.plan_sessions.map((s) => ({
      id: s.id,
      date: s.scheduled_date,
      kind: s.kind,
      status: s.status,
      exam: s.exam
        ? { id: s.exam.id, folio: s.exam.folio, level: s.exam.level, score: pct(s.exam.score_achieved, s.exam.max_score), completedAt: s.exam.completed_at }
        : null,
    })),
  }));
}

/** Crea el plan y su calendario; devuelve el id. */
export async function crearPlan(draft: PlanDraft): Promise<number> {
  const { data, error } = await supabase.rpc("crear_plan", {
    p_carrera: draft.careerId,
    p_fecha_examen: draft.officialDate,
    p_dias: draft.practiceDays,
    p_por_dia: draft.examsPerDay,
    p_modo: draft.difficultyMode,
    p_nivel: draft.fixedLevel,
    p_horario: draft.timeWindow,
  });
  if (error) fail(error);
  return Number(data);
}

export async function moverSesion(sesionId: number, fecha: string) {
  const { error } = await supabase.rpc("mover_sesion_plan", { p_sesion: sesionId, p_fecha: fecha });
  if (error) fail(error);
}

export async function cancelarPlan(planId: number) {
  const { error } = await supabase.rpc("cancelar_plan", { p_plan: planId });
  if (error) fail(error);
}

/** Dificultad que le toca al siguiente examen (la decide la base). */
export async function nivelPlan(planId: number): Promise<Nivel> {
  const { data, error } = await supabase.rpc("nivel_plan", { p_plan: planId });
  if (error) fail(error);
  return data as Nivel;
}

type ItemRow = {
  codigo: string;
  materia: string;
  materia_nombre: string;
  dificultad: Dificultad;
  valor_puntos: number;
  lectura: string | null;
  pregunta: string;
  respuestas: { id: number; texto: string }[];
};

/** Arma el examen de una sesión pendiente (de hoy o atrasada). */
export async function generarExamenPlan(sesionId: number, total: number): Promise<{ nivel: Nivel; items: ExamItem[] }> {
  const { data, error } = await supabase.rpc("generar_examen_plan", { p_sesion: sesionId, p_total: total });
  if (error) fail(error);
  const r = data as { nivel: Nivel; preguntas: ItemRow[] };
  return {
    nivel: r.nivel,
    items: r.preguntas.map((q) => ({
      codigo: q.codigo,
      materia: q.materia,
      materiaNombre: q.materia_nombre,
      dificultad: q.dificultad,
      valorPuntos: Number(q.valor_puntos),
      lectura: q.lectura,
      pregunta: q.pregunta,
      respuestas: q.respuestas,
    })),
  };
}

/** Califica y congela el examen del plan; devuelve el id de exam_history. */
export async function guardarExamenPlan(sesionId: number, sheet: AnswerSheet): Promise<number> {
  const { data, error } = await supabase.rpc("guardar_examen_plan", {
    p_sesion: sesionId,
    p_nivel: sheet.nivel,
    p_respuestas: sheet.respuestas.map((r) => ({
      codigo: r.codigo,
      respuesta_id: r.respuestaId,
      segundos: Math.round(r.segundos),
      orden: r.orden,
    })),
    p_tiempo_limite: sheet.tiempoLimite,
    p_tiempo_usado: Math.round(sheet.tiempoUsado),
    p_agotado: sheet.agotado,
    p_aviso_aceptado: true,
  });
  if (error) fail(error);
  return Number(data);
}

/** Resumen por materia de varios exámenes (para el mapa de calor). */
export async function getMateriasDe(examIds: number[]): Promise<Map<number, MateriaSummary[]>> {
  if (examIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("exam_history")
    .select("id, materias:frozen_exam_data->resumen_por_materia")
    .in("id", examIds);
  if (error) fail(error);
  return new Map(
    (data as unknown as { id: number; materias: MateriaSummary[] | null }[]).map((r) => [
      r.id,
      (r.materias ?? []).map((m) => ({ ...m, total: Number(m.total), correctas: Number(m.correctas), porcentaje_aciertos: Number(m.porcentaje_aciertos) })),
    ])
  );
}
