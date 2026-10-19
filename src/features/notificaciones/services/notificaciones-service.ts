/**
 * Bandeja In-App (campana). El usuario solo lee sus avisos (RLS) y los marca como leídos con
 * `marcar_notificaciones_leidas`. Los avisos los crea la base con `notificar()`.
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
  return {
    items: ((list.data ?? []) as Row[]).map((r) => ({
      id: r.id,
      eventCode: r.event_code,
      title: r.title,
      body: r.body,
      actionUrl: r.action_url,
      readAt: r.read_at,
      createdAt: r.created_at,
    })),
    unread: count.count ?? 0,
  };
}

/** Sin `ids` = todas. */
export async function markRead(ids?: string[]): Promise<void> {
  const { error } = await supabase.rpc("marcar_notificaciones_leidas", { p_ids: ids ?? null });
  if (error) throw error;
}
