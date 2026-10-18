/**
 * Cuentas vinculadas (20261025000000_cuentas_vinculadas.sql): el estudiante con tutor no compra; le pide a su
 * tutor activar o renovar el plan (aviso en el panel + correo). Toda la facturación vive en la cuenta del tutor.
 */

import { supabase } from "@/lib/supabase/client";

export type MyTutor = {
  id: string;
  name: string;
  type: "parent" | "teacher" | "director" | "admin";
  linkedAt: string;
  /** Le da acceso ilimitado ahora mismo con un cupo de su plan. */
  sponsors: boolean;
  lastRequestAt: string | null;
};

type TutorRow = {
  id: string;
  nombre: string;
  tipo: MyTutor["type"];
  vinculado: string;
  patrocina: boolean;
  ultima_solicitud: string | null;
};

export async function getMyTutors(): Promise<MyTutor[]> {
  const { data, error } = await supabase.rpc("mis_tutores");
  if (error) throw error;
  return ((data ?? []) as TutorRow[]).map((t) => ({
    id: t.id,
    name: t.nombre,
    type: t.tipo,
    linkedAt: t.vinculado,
    sponsors: t.patrocina,
    lastRequestAt: t.ultima_solicitud,
  }));
}

/** Avisa al tutor en su panel y, si se puede, por correo (el correo es opcional: el aviso ya quedó). */
export async function requestPlanFromTutor() {
  const { data, error } = await supabase.rpc("solicitar_plan_tutor");
  if (error) throw error;
  const ids = (data as { ids: number[] }).ids;
  const { data: auth } = await supabase.auth.getSession();
  await fetch("/api/tutor/solicitud", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth.session ? { authorization: `Bearer ${auth.session.access_token}` } : {}),
    },
    body: JSON.stringify({ ids }),
  }).catch(() => null);
}

export async function unlinkMyTutor(tutorId: string) {
  const { error } = await supabase.rpc("desvincular_mi_tutor", { p_tutor: tutorId });
  if (error) throw error;
}

/* ─────────── Panel del tutor ─────────── */

export type PlanRequest = { id: number; studentId: string; alias: string; name: string; at: string };

export async function getPlanRequests(): Promise<PlanRequest[]> {
  const { data, error } = await supabase.rpc("solicitudes_tutor");
  if (error) throw error;
  return ((data ?? []) as { id: number; estudiante: string; alias: string; nombre: string; fecha: string }[]).map((r) => ({
    id: r.id,
    studentId: r.estudiante,
    alias: r.alias,
    name: r.nombre,
    at: r.fecha,
  }));
}

export async function dismissPlanRequests(ids: number[]) {
  const { error } = await supabase.rpc("atender_solicitudes_tutor", { p_ids: ids });
  if (error) throw error;
}

export const errorText = (e: unknown) =>
  (e as { message?: string })?.message || "Algo salió mal. Intenta de nuevo.";
