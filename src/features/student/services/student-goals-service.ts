/**
 * Metas del alumno (Universidad → Carrera) en `student_goals`. El cliente solo lee; agregar, cambiar y
 * quitar pasan por RPCs que validan licencia, catálogo, planes activos y el tope de carreras.
 */

import { supabase } from "@/lib/supabase/client";

/** Tope de carreras simultáneas (mismo valor que `metas_maximas()` en la base). */
export const MAX_GOALS = 5;

/** "Mis carreras"; `?agregar=1` abre directo el alta (o el muro de pago en Demo). */
export const MY_CAREERS_PATH = "/app/student/carreras";
export const ADD_CAREER_PATH = `${MY_CAREERS_PATH}?agregar=1`;

export async function addGoal(careerId: string) {
  const { error } = await supabase.rpc("agregar_meta", { p_carrera: careerId });
  if (error) throw error;
}

export async function changeGoal(currentId: string, nextId: string) {
  const { error } = await supabase.rpc("cambiar_meta", { p_actual: currentId, p_nueva: nextId });
  if (error) throw error;
}

export async function removeGoal(careerId: string) {
  const { error } = await supabase.rpc("quitar_meta", { p_carrera: careerId });
  if (error) throw error;
}

export function goalErrorMessage(e: unknown) {
  if (e && typeof e === "object" && "code" in e && e.code === "PGRST202")
    return "Falta correr en Supabase la migración 20261004010000_metas_estudiante.sql.";
  return e && typeof e === "object" && "message" in e && typeof e.message === "string" && e.message
    ? e.message
    : "Algo salió mal. Intenta de nuevo.";
}
