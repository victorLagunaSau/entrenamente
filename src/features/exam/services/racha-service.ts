/**
 * Examen Racha en Supabase (migración 20260928000000_examen_racha.sql). Igual que el Examen Libre:
 * el alumno nunca recibe ponderaciones y la calificación se hace en la base.
 */

import { supabase } from "@/lib/supabase/client";

import type { Dificultad } from "../types";
import type { ExamItem, Nivel } from "../lib/libre";
import { type AnswerSheet, ExamenError } from "./libre-service";

export type RachaGame = {
  nivel: Nivel;
  /** Última racha de esta carrera (null = primera vez). */
  anterior: { nivel: Nivel; porcentaje: number } | null;
  items: ExamItem[];
};

type Row = {
  nivel: Nivel;
  anterior: { nivel: Nivel; porcentaje: number | string } | null;
  preguntas: {
    codigo: string;
    materia: string;
    materia_nombre: string;
    dificultad: Dificultad;
    valor_puntos: number;
    lectura: string | null;
    pregunta: string;
    respuestas: { id: number; texto: string }[];
  }[];
};

function fail(message: string, code?: string): never {
  if (code === "PGRST202") throw new ExamenError("La racha aún no está instalada en la base de datos.");
  throw new ExamenError(message);
}

/** Arma la racha: el nivel lo decide la base; 2 preguntas por materia, alternadas. */
export async function generarRacha(carreraId: string): Promise<RachaGame> {
  const { data, error } = await supabase.rpc("generar_examen_racha", { p_carrera: carreraId });
  if (error) fail(error.message, error.code);
  const r = data as Row;
  return {
    nivel: r.nivel,
    anterior: r.anterior ? { nivel: r.anterior.nivel, porcentaje: Number(r.anterior.porcentaje) } : null,
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

/** Califica y congela la racha en `exam_history`; devuelve el id del registro. */
export async function guardarRacha(sheet: AnswerSheet): Promise<number> {
  const { data, error } = await supabase.rpc("guardar_examen_racha", {
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
  if (error) fail(error.message, error.code);
  return Number(data);
}
