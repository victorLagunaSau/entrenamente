/**
 * /api/notificaciones/despachar — manda los correos pendientes del centro de notificaciones.
 *   · GET  cron diario de Vercel (vercel.json): además revisa vencimientos (P7 por vencer, P9 paso a Demo).
 *   · POST pg_net, al crearse un aviso con correo (secretos `notificaciones_url` / `notificaciones_secret` del Vault).
 * Ambos con `Authorization: Bearer CRON_SECRET` (Vercel lo manda solo en el cron).
 */

import { supabaseAdmin } from "@/features/pagos/server/clients";
import { sendPendingEmails } from "@/features/notificaciones/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const authorized = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
};

async function run(withExpirations: boolean) {
  try {
    let vencimientos: unknown = null;
    if (withExpirations) {
      const { data, error } = await supabaseAdmin().rpc("procesar_vencimientos");
      if (error) throw new Error(`procesar_vencimientos: ${error.message}`);
      vencimientos = data;
    }
    const correos = await sendPendingEmails(withExpirations ? 200 : 50);
    return Response.json({ vencimientos, correos });
  } catch (err) {
    console.error("[notificaciones/despachar]", err);
    return new Response("Error al despachar", { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("No autorizado", { status: 401 });
  return run(true);
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("No autorizado", { status: 401 });
  return run(false);
}
