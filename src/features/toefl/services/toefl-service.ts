/**
 * TOEFL ITP del alumno (migración 20261101000000_toefl_diagnostico.sql). Las preguntas llegan sin
 * ponderaciones ni diagnósticos; la base califica, congela el intento en exam_history y fija el nivel MCER.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";

import type { PlayerItem, PlayerSheet } from "../lib/player";
import type { AgeRange, McerLevel, Section, ToeflOption } from "../types";

/** Error con mensaje listo para mostrar; `locked` = hace falta el acceso ilimitado. */
export class ToeflError extends Error {
  constructor(
    message: string,
    readonly locked = false
  ) {
    super(message);
  }
}

function fail(error: PostgrestError): never {
  if (error.code === "PGRST202") throw new ToeflError("El módulo TOEFL aún no está instalado en la base de datos.");
  throw new ToeflError(error.message, error.code === "P0402");
}

/* ─────────────────────────── Estado ─────────────────────────── */

export type ToeflAttempt = {
  id: number;
  folio: string;
  tipo: "toefl_diagnostico" | "toefl_practica" | "toefl_plan" | "toefl_racha";
  nivel: McerLevel;
  aciertos: number;
  fecha: string;
};

export type ToeflEstado = {
  ageRange: AgeRange;
  nivel: McerLevel | null;
  accesoIlimitado: boolean;
  diagnosticos: number;
  puedeDiagnostico: boolean;
  preguntasDisponibles: number;
  historial: ToeflAttempt[];
};

export async function getEstado(): Promise<ToeflEstado> {
  const { data, error } = await supabase.rpc("estado_toefl");
  if (error) fail(error);
  const d = data as {
    age_range: AgeRange;
    nivel: McerLevel | null;
    acceso_ilimitado: boolean;
    diagnosticos: number;
    puede_diagnostico: boolean;
    preguntas_disponibles: number;
    historial: ToeflAttempt[];
  };
  return {
    ageRange: d.age_range,
    nivel: d.nivel,
    accesoIlimitado: d.acceso_ilimitado,
    diagnosticos: d.diagnosticos,
    puedeDiagnostico: d.puede_diagnostico,
    preguntasDisponibles: d.preguntas_disponibles,
    historial: d.historial,
  };
}

/** Rango de edad del examen (columna editable por el propio alumno). */
export async function setAgeRange(userId: string, ageRange: AgeRange): Promise<void> {
  const { error } = await supabase.from("profiles").update({ target_toefl_age_range: ageRange }).eq("id", userId);
  if (error) fail(error);
}

/* ─────────────────────────── Diagnóstico ─────────────────────────── */

/** 15:00 fijos (el mismo límite que usa la base al congelar). */
export const DIAGNOSTICO_SEGUNDOS = 15 * 60;

type ItemRow = {
  id: string;
  section: Section;
  mcer_level: McerLevel;
  question_text: string;
  options: { id: string; texto: string }[];
  context: { id: string; audio_url: string | null; audio_max_plays: number; reading_passage: string | null } | null;
};

export async function generarDiagnostico(): Promise<PlayerItem[]> {
  const { data, error } = await supabase.rpc("generar_diagnostico_toefl");
  if (error) fail(error);
  return (data as ItemRow[]).map((r) => ({
    id: r.id,
    section: r.section,
    mcerLevel: r.mcer_level,
    questionText: r.question_text,
    options: r.options,
    context: r.context
      ? {
          id: r.context.id,
          audioUrl: r.context.audio_url,
          audioMaxPlays: r.context.audio_max_plays,
          readingPassage: r.context.reading_passage,
        }
      : null,
  }));
}

/** Califica y congela; devuelve el id de exam_history. */
export async function guardarDiagnostico(sheet: PlayerSheet): Promise<number> {
  const { data, error } = await supabase.rpc("guardar_diagnostico_toefl", {
    p_respuestas: sheet.respuestas.map((r) => ({ id: r.id, respuesta_id: r.respuestaId, segundos: Math.round(r.segundos) })),
    p_tiempo_usado: Math.round(sheet.tiempoUsado),
    p_agotado: sheet.agotado,
    p_aviso_aceptado: true,
  });
  if (error) fail(error);
  return data as number;
}

/* ─────────────────────────── Intento congelado ─────────────────────────── */

export type SnapshotQuestion = {
  id_original: string;
  section: Section;
  mcer_level: McerLevel;
  audio_url: string | null;
  reading_passage: string | null;
  transcription: string | null;
  pregunta: string;
  respuestas: ToeflOption[];
  respuesta_seleccionada_id: string | null;
  ponderacion_obtenida: number;
  diagnostico_error_es: string | null;
  diagnostico_error_en: string | null;
  solucion_es: string[];
  solucion_en: string[];
  tiempo_respuesta_segundos: number;
};

const TIPOS: ToeflAttempt["tipo"][] = ["toefl_diagnostico", "toefl_practica", "toefl_plan", "toefl_racha"];

export type ToeflRecord = {
  id: number;
  folio: string;
  tipo: ToeflAttempt["tipo"];
  nivel: McerLevel;
  nivelAnterior: McerLevel | null;
  total: number;
  respondidas: number;
  puntos: number;
  maximo: number;
  tiempoLimite: number;
  tiempoUsado: number;
  agotado: boolean;
  fecha: string;
  porNivel: { nivel: McerLevel; total: number; correctas: number; porcentaje_aciertos: number }[];
  porSeccion: { materia_clave: Section; total: number; correctas: number; sin_responder: number; porcentaje_aciertos: number }[];
  preguntas: SnapshotQuestion[];
};

export async function getIntento(id: number): Promise<ToeflRecord | null> {
  const { data, error } = await supabase.from("exam_history").select("*").eq("id", id).in("exam_type", TIPOS).maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const f = data.frozen_exam_data as {
    toefl?: { nivel_anterior: McerLevel | null };
    resumen_por_nivel?: ToeflRecord["porNivel"];
    resumen_por_materia?: ToeflRecord["porSeccion"];
    questions_snapshot?: SnapshotQuestion[];
  };
  return {
    id: data.id,
    folio: data.folio,
    tipo: data.exam_type,
    nivel: data.level,
    nivelAnterior: f.toefl?.nivel_anterior ?? null,
    total: data.total_questions,
    respondidas: data.answered_questions,
    puntos: Number(data.score_achieved),
    maximo: Number(data.max_score),
    tiempoLimite: data.time_limit_seconds,
    tiempoUsado: data.time_spent_seconds,
    agotado: data.timed_out,
    fecha: data.completed_at,
    porNivel: (f.resumen_por_nivel ?? []).map((n) => ({ ...n, total: Number(n.total), correctas: Number(n.correctas), porcentaje_aciertos: Number(n.porcentaje_aciertos) })),
    porSeccion: (f.resumen_por_materia ?? []).map((s) => ({
      ...s,
      total: Number(s.total),
      correctas: Number(s.correctas),
      sin_responder: Number(s.sin_responder),
      porcentaje_aciertos: Number(s.porcentaje_aciertos),
    })),
    preguntas: f.questions_snapshot ?? [],
  };
}
