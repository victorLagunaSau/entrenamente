/**
 * POST /api/notificaciones/push — manda las notificaciones push pendientes de la WebApp.
 * La llama Supabase (pg_net): al crearse cada entrega push y cada 5 minutos con pg_cron (lo que salió del horario de
 * silencio y los reintentos). `Authorization: Bearer <push_secret del Vault>`.
 */

import { ConfigError } from "@/features/pagos/server/clients";
import { dispatchPendingPush, validDispatchSecret } from "@/features/notificaciones/server/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!(await validDispatchSecret(req))) return new Response("No autorizado", { status: 401 });
    return Response.json(await dispatchPendingPush());
  } catch (err) {
    console.error("[notificaciones/push]", err);
    return new Response(err instanceof ConfigError ? err.message : "Error al despachar", { status: 500 });
  }
}
