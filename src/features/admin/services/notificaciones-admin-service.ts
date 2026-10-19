/**
 * Administrador de notificaciones (/admin/notificaciones). Las funciones `admin_*` validan que quien llama sea admin;
 * los avisos se crean con `notificar()`, así respetan preferencias, edad y llegan al instante a la campana.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";

export class AdminNotifError extends Error {}

function fail(error: PostgrestError): never {
  if (error.code === "PGRST202") {
    throw new AdminNotifError("Falta correr en Supabase la migración 20261030000000_admin_notificaciones.sql.");
  }
  throw new AdminNotifError(error.message);
}

export type TipoEnvio = "aviso" | "promocion";
export type PlanFiltro = "todos" | "pro" | "demo";
export type TipoUsuarioFiltro = "student" | "parent" | "teacher";

export type Audiencia =
  | { modo: "usuarios"; ids: string[] }
  | { modo: "filtro"; tipos: TipoUsuarioFiltro[]; plan: PlanFiltro; institucion: string | null; carrera: string | null };

export type Conteo = { total: number; alcanzables: number };

export type Campana = {
  id: string;
  tipo: TipoEnvio;
  title: string;
  body: string;
  action_url: string | null;
  audiencia_resumen: string;
  destinatarios: number;
  leidas: number;
  created_at: string;
  retirada_at: string | null;
  enviado_por: string;
};

export async function contarAudiencia(audiencia: Audiencia, tipo: TipoEnvio): Promise<Conteo> {
  const { data, error } = await supabase.rpc("admin_contar_audiencia", { p_audiencia: audiencia, p_tipo: tipo });
  if (error) fail(error);
  return data as Conteo;
}

export async function enviarNotificacion(input: {
  tipo: TipoEnvio;
  title: string;
  body: string;
  actionUrl: string | null;
  audiencia: Audiencia;
  resumen: string;
}): Promise<{ id: string; enviados: number }> {
  const { data, error } = await supabase.rpc("admin_enviar_notificacion", {
    p_tipo: input.tipo,
    p_title: input.title,
    p_body: input.body,
    p_action_url: input.actionUrl,
    p_audiencia: input.audiencia,
    p_resumen: input.resumen,
  });
  if (error) fail(error);
  return data as { id: string; enviados: number };
}

export async function getCampanas(): Promise<Campana[]> {
  const { data, error } = await supabase.rpc("admin_campanas", { p_limite: 30 });
  if (error) fail(error);
  return (data ?? []) as Campana[];
}

/** Quita el envío de todas las bandejas. Devuelve cuántos avisos se borraron. */
export async function retirarCampana(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("admin_retirar_campana", { p_id: id });
  if (error) fail(error);
  return Number(data ?? 0);
}

/** Pantallas frecuentes para el enlace del aviso. */
export const DESTINOS: { value: string; label: string }[] = [
  { value: "", label: "Sin enlace" },
  { value: "/pricing", label: "Planes y precios" },
  { value: "/app/student", label: "Inicio del estudiante" },
  { value: "/app/student/racha", label: "Racha" },
  { value: "/app/student/plan", label: "Plan de estudio" },
  { value: "/app/student/carreras", label: "Mis carreras" },
  { value: "/app/dashboard", label: "Panel del tutor" },
  { value: "/app/cuenta", label: "Mi cuenta" },
  { value: "/soporte", label: "Soporte" },
];
