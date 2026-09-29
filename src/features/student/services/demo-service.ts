/**
 * Home Demo (migración 20260928050000_home_demo.sql). Los textos, el precio y el interruptor de la campaña
 * los define el admin en `demo_campaign_config`; la cantidad de exámenes gratis es la del propio alumno
 * (fijada al registrarse), así que el camino de exámenes se adapta solo.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import type { SnapshotQuestion } from "@/features/exam/lib/libre";
import { supabase } from "@/lib/supabase/client";

/** Error con mensaje listo para mostrar en la UI. */
export class DemoError extends Error {}

function fail(error: PostgrestError): never {
  // PGRST202: función inexistente; 42703: columna inexistente → falta correr una migración del Home Demo.
  if (error.code === "PGRST202" || error.code === "42703") {
    throw new DemoError("A la base de datos le falta la última migración de la prueba gratuita (20260928060000).");
  }
  throw new DemoError(error.message);
}

export type DemoCampaign = {
  activa: boolean;
  tituloCampana: string;
  /** Marcadores: {alias}, {carrera}, {universidad}, {n}. */
  tituloBienvenida: string;
  subtitulo: string;
  fraseCierre: string;
  /** Plan Estudiante: base para descuentos futuros. */
  precioMensualMxn: number;
  precioAnualMxn: number;
  /** Días de prueba para quien se registra desde hoy (solo lo usa el admin). */
  diasPrueba: number;
  /** Fin del periodo de prueba del alumno (null si no es estudiante). */
  pruebaTermina: string | null;
  /** Lo que recibe quien se registra desde hoy (solo lo usa el admin). */
  pruebasAlRegistrarse: number;
  /** Exámenes gratis del alumno: largo del camino. */
  pruebasOtorgadas: number;
  pruebasUsadas: number;
};

type CampaignRow = {
  activa: boolean;
  titulo_campana: string;
  titulo_bienvenida: string;
  subtitulo: string;
  frase_cierre: string;
  precio_mensual_mxn: number | string;
  precio_anual_mxn: number | string;
  dias_prueba: number;
  prueba_termina: string | null;
  pruebas_al_registrarse: number;
  pruebas_otorgadas: number;
  pruebas_usadas: number;
};

const toCampaign = (r: CampaignRow): DemoCampaign => ({
  activa: r.activa,
  tituloCampana: r.titulo_campana,
  tituloBienvenida: r.titulo_bienvenida,
  subtitulo: r.subtitulo,
  fraseCierre: r.frase_cierre,
  precioMensualMxn: Number(r.precio_mensual_mxn),
  precioAnualMxn: Number(r.precio_anual_mxn),
  diasPrueba: r.dias_prueba,
  pruebaTermina: r.prueba_termina,
  pruebasAlRegistrarse: r.pruebas_al_registrarse,
  pruebasOtorgadas: r.pruebas_otorgadas,
  pruebasUsadas: r.pruebas_usadas,
});

export async function getDemoCampaign(): Promise<DemoCampaign> {
  const { data, error } = await supabase.rpc("get_demo_campaign");
  if (error) fail(error);
  if (!data) throw new DemoError("Inicia sesión para ver tu prueba gratuita.");
  return toCampaign(data as CampaignRow);
}

export type DemoCampaignInput = Pick<
  DemoCampaign,
  | "activa"
  | "tituloCampana"
  | "tituloBienvenida"
  | "subtitulo"
  | "fraseCierre"
  | "precioMensualMxn"
  | "precioAnualMxn"
  | "diasPrueba"
  | "pruebasAlRegistrarse"
>;

/** Solo admin (lo valida la base). */
export async function saveDemoCampaign(input: DemoCampaignInput): Promise<DemoCampaign> {
  const { data, error } = await supabase.rpc("guardar_demo_campaign", {
    p_activa: input.activa,
    p_titulo_campana: input.tituloCampana,
    p_titulo_bienvenida: input.tituloBienvenida,
    p_subtitulo: input.subtitulo,
    p_frase_cierre: input.fraseCierre,
    p_precio_mensual_mxn: input.precioMensualMxn,
    p_precio_anual_mxn: input.precioAnualMxn,
    p_dias_prueba: input.diasPrueba,
    p_pruebas_al_registrarse: input.pruebasAlRegistrarse,
  });
  if (error) fail(error);
  return toCampaign(data as CampaignRow);
}

/** Sustituye {alias}, {carrera}, {universidad} y {n}; un marcador sin valor se quita. */
export function fillTemplate(text: string, values: Record<"alias" | "carrera" | "universidad" | "n", string>) {
  return text
    .replace(/\{(alias|carrera|universidad|n)\}/g, (_, key: keyof typeof values) => values[key])
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

/** "$80" o "$79.16" (con centavos solo si los hay). */
export function formatMxn(mxn: number) {
  return `$${Number.isInteger(mxn) ? String(mxn) : mxn.toFixed(2)}`;
}

/** Mensualidad equivalente del plan anual, sin redondear hacia arriba: $950 → $79.16. */
export const monthlyOfYearly = (yearly: number) => Math.floor((yearly * 100) / 12) / 100;

/** Examen que gastó una prueba gratis, con sus preguntas congeladas (para la guía de estudio). */
export type FreeExam = {
  id: number;
  folio: string;
  /** "Prueba gratuita N": su número dentro del periodo de prueba. */
  numero: number;
  completedAt: string;
  /** Porcentaje de puntos (0–100). */
  score: number;
  totalQuestions: number;
  questions: SnapshotQuestion[];
};

type FreeExamRow = {
  id: number;
  folio: string;
  prueba_numero: number | null;
  completed_at: string;
  score_achieved: number | string;
  max_score: number | string;
  total_questions: number;
  preguntas: SnapshotQuestion[] | null;
};

/** Pruebas gratis del alumno, de la primera a la más reciente. */
export async function getFreeExams(studentId: string): Promise<FreeExam[]> {
  const { data, error } = await supabase
    .from("exam_history")
    .select("id, folio, prueba_numero, completed_at, score_achieved, max_score, total_questions, preguntas:frozen_exam_data->questions_snapshot")
    .eq("student_id", studentId)
    .eq("exam_type", "libre")
    .eq("prueba_gratis", true)
    .order("completed_at", { ascending: true });
  if (error) fail(error);

  return (data as unknown as FreeExamRow[]).map((r, i) => {
    const max = Number(r.max_score);
    return {
      id: r.id,
      folio: r.folio,
      numero: r.prueba_numero ?? i + 1,
      completedAt: r.completed_at,
      score: max > 0 ? Math.round((1000 * Number(r.score_achieved)) / max) / 10 : 0,
      totalQuestions: r.total_questions,
      questions: (r.preguntas ?? []).map((q) => ({
        ...q,
        valor_puntos: Number(q.valor_puntos),
        ponderacion_obtenida: Number(q.ponderacion_obtenida),
        respuestas: q.respuestas.map((x) => ({ ...x, ponderacion: Number(x.ponderacion) })),
      })),
    };
  });
}
