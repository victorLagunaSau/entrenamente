/**
 * Examen Libre en Supabase (migración 20260927040000_examen_libre.sql).
 * El banco es solo de admin: el alumno pasa por funciones que nunca le envían la respuesta correcta
 * antes de terminar. La calificación y la "fotografía" del examen se hacen en la base.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";

import type { Dificultad } from "../types";
import type { ExamItem, ExamRecord, ExamTarget, MateriaSummary, Nivel, SnapshotQuestion } from "../lib/libre";

/** Error con mensaje listo para mostrar en la UI. */
export class ExamenError extends Error {}

function fail(error: PostgrestError): never {
  if (error.code === "PGRST202") throw new ExamenError("El módulo de exámenes aún no está instalado en la base de datos.");
  throw new ExamenError(error.message);
}

/** Preguntas distintas por carrera y dificultad (solo conteos). */
export type Disponibles = Map<string, Record<Dificultad, number>>;

export async function getDisponibles(): Promise<Disponibles> {
  const { data, error } = await supabase.rpc("opciones_examen_libre");
  if (error) fail(error);
  const rows = data as { carrera_id: string; facil: number; media: number; dificil: number }[];
  return new Map(rows.map((r) => [r.carrera_id, { facil: r.facil, media: r.media, dificil: r.dificil }]));
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

/** Arma el examen en la base: nivel dominante + relleno, una variante por raíz, agrupado por materia. */
export async function generarExamen(carreraId: string, nivel: Nivel, total: number): Promise<ExamItem[]> {
  const { data, error } = await supabase.rpc("generar_examen_libre", { p_carrera: carreraId, p_nivel: nivel, p_total: total });
  if (error) fail(error);
  return (data as ItemRow[]).map((r) => ({
    codigo: r.codigo,
    materia: r.materia,
    materiaNombre: r.materia_nombre,
    dificultad: r.dificultad,
    valorPuntos: Number(r.valor_puntos),
    lectura: r.lectura,
    pregunta: r.pregunta,
    respuestas: r.respuestas,
  }));
}

export type AnswerSheet = {
  carreraId: string;
  nivel: Nivel;
  /** En el orden del examen. */
  respuestas: { codigo: string; respuestaId: number | null; segundos: number; orden: number[] }[];
  tiempoLimite: number;
  tiempoUsado: number;
  agotado: boolean;
};

/** Califica y congela el examen en `exam_history`; devuelve el id del registro. */
export async function guardarExamen(sheet: AnswerSheet): Promise<number> {
  const { data, error } = await supabase.rpc("guardar_examen_libre", {
    p_carrera: sheet.carreraId,
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

type HistoryRow = {
  id: number;
  folio: string;
  exam_type: ExamRecord["examType"];
  university_key: string;
  university_name: string;
  career_name: string;
  level: Nivel;
  total_questions: number;
  answered_questions: number;
  score_achieved: number;
  max_score: number;
  time_limit_seconds: number;
  time_spent_seconds: number;
  timed_out: boolean;
  completed_at: string;
  frozen_exam_data: {
    institucion: { clave: string; nombre: string; color_id: string | null };
    carrera: { id: string; nombre: string; area: string | null };
    resumen_por_materia: MateriaSummary[];
    questions_snapshot: SnapshotQuestion[];
  };
};

/** Examen guardado por id o por folio (RLS: solo el alumno dueño o un admin). */
export async function getExamRecord(key: { id: number } | { folio: string }): Promise<ExamRecord | null> {
  const q = supabase.from("exam_history").select("*");
  const { data, error } = await ("id" in key ? q.eq("id", key.id) : q.eq("folio", key.folio.trim().toUpperCase())).maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const r = data as HistoryRow;
  const f = r.frozen_exam_data;
  const target: ExamTarget = {
    institucion: { id: f.institucion.clave.toLowerCase(), clave: f.institucion.clave, nombre: f.institucion.nombre, colorId: f.institucion.color_id },
    carrera: f.carrera,
  };
  const num = (x: unknown) => Number(x);
  return {
    id: r.id,
    folio: r.folio,
    examType: r.exam_type,
    universityKey: r.university_key,
    universityName: r.university_name,
    careerName: r.career_name,
    level: r.level,
    totalQuestions: r.total_questions,
    answeredQuestions: r.answered_questions,
    score: num(r.score_achieved),
    maxScore: num(r.max_score),
    timeLimitSeconds: r.time_limit_seconds,
    timeSpentSeconds: r.time_spent_seconds,
    timedOut: r.timed_out,
    completedAt: r.completed_at,
    target,
    materias: f.resumen_por_materia.map((m) => ({
      ...m,
      puntos: num(m.puntos),
      maximo: num(m.maximo),
      porcentaje_aciertos: num(m.porcentaje_aciertos),
    })),
    questions: f.questions_snapshot.map((q) => ({
      ...q,
      valor_puntos: num(q.valor_puntos),
      ponderacion_obtenida: num(q.ponderacion_obtenida),
      respuestas: q.respuestas.map((x) => ({ ...x, ponderacion: num(x.ponderacion) })),
    })),
  };
}
