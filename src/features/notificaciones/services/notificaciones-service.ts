/**
 * Bandeja In-App (campana). El usuario solo lee sus avisos (RLS) y los marca como leídos con
 * `marcar_notificaciones_leidas`. Los avisos los crea la base con `notificar()`; los nuevos llegan por Realtime.
 * También registra el celular para push (fase de apps).
 */

import { supabase } from "@/lib/supabase/client";

export type AppNotification = {
  id: string;
  eventCode: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export type Inbox = { items: AppNotification[]; unread: number };

type Row = {
  id: string;
  event_code: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

/** Últimos `limit` avisos y el total sin leer (aunque no quepan en la lista). */
export async function getInbox(userId: string, limit = 10): Promise<Inbox> {
  const [list, count] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, event_code, title, body, action_url, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);
  if (list.error) throw list.error;
  if (count.error) throw count.error;
  return { items: ((list.data ?? []) as Row[]).map(fromRow), unread: count.count ?? 0 };
}

/** Sin `ids` = todas. */
export async function markRead(ids?: string[]): Promise<void> {
  const { error } = await supabase.rpc("marcar_notificaciones_leidas", { p_ids: ids ?? null });
  if (error) throw error;
}

/** Aviso recién creado (llega por Realtime). */
export function fromRow(r: Row): AppNotification {
  return {
    id: r.id,
    eventCode: r.event_code,
    title: r.title,
    body: r.body,
    actionUrl: r.action_url,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

/**
 * Escucha los avisos nuevos del usuario (Supabase Realtime; RLS: solo los suyos). Devuelve la función para dejar de
 * escuchar. Si Realtime no conecta, la campana sigue al día con su consulta de cada minuto.
 */
export function subscribeToNew(userId: string, onNew: (n: AppNotification) => void): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => onNew(fromRow(payload.new as Row))
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ───────────────────────── Push (apps) ─────────────────────────

export type PushPlatform = "ios" | "android" | "web";

/**
 * Para la fase de apps: llamar al obtener el token del celular (@capacitor/push-notifications → "registration")
 * y en cada arranque. Desde ese momento `notificar()` deja una entrega push pendiente por cada aviso.
 */
export async function registerPushDevice(token: string, platform: PushPlatform, deviceName?: string): Promise<void> {
  const { error } = await supabase.rpc("registrar_dispositivo_push", {
    p_token: token,
    p_platform: platform,
    p_device_name: deviceName ?? null,
  });
  if (error) throw error;
}

/** Al cerrar sesión en el celular, para que no le lleguen avisos de esta cuenta. */
export async function unregisterPushDevice(token: string): Promise<void> {
  const { error } = await supabase.rpc("quitar_dispositivo_push", { p_token: token });
  if (error) throw error;
}

/** Aviso de prueba para el propio usuario. false = ya mandó uno en este minuto. */
export async function sendTestNotification(): Promise<boolean> {
  const { data, error } = await supabase.rpc("enviarme_aviso_prueba");
  if (error) throw error;
  return Boolean(data);
}
