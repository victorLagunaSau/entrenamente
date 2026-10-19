/**
 * Centro de notificaciones del lado del servidor (rutas /api/*). Nunca se importa desde el navegador.
 * notify() llama a `notificar()`: aviso en la campana (llega al instante por Realtime) y, cuando el usuario tenga
 * la app con un celular registrado, la entrega push pendiente según el catálogo y sus preferencias.
 */

import { supabaseAdmin } from "@/features/pagos/server/clients";

/** Códigos del catálogo `notification_events` (ver docs/notificaciones-mapeo-eventos.md). */
export type EventCode = "P4" | "P5" | "P8";

export type Notice = {
  title: string;
  body: string;
  /** Ruta interna a la que lleva el aviso (empieza con /). */
  url?: string;
  /** Misma clave = mismo aviso: no se repite para ese usuario. */
  dedupe?: string;
};

/** Devuelve el id del aviso, o null si ya existía. Si falla, lo registra y sigue: un aviso nunca tumba un pago. */
export async function notify(userId: string, code: EventCode, notice: Notice): Promise<string | null> {
  const { data, error } = await supabaseAdmin().rpc("notificar", {
    p_user_id: userId,
    p_event_code: code,
    p_title: notice.title,
    p_body: notice.body,
    p_action_url: notice.url ?? null,
    p_dedupe_key: notice.dedupe ?? null,
  });
  if (error) {
    console.error(`[notificaciones] ${code}`, error.message);
    return null;
  }
  return (data as string | null) ?? null;
}
