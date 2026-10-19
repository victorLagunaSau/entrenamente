/**
 * Despachador de push de la WebApp (Web Push con claves VAPID). Nunca se importa desde el navegador.
 *   · NEXT_PUBLIC_VAPID_PUBLIC_KEY  clave pública (el navegador la usa al suscribirse)
 *   · VAPID_PRIVATE_KEY             clave privada (solo servidor)
 *   · VAPID_SUBJECT                 contacto para los servicios push (mailto:… o https://…), opcional
 * Toma las entregas con `tomar_push_pendientes()` (ya respeta el horario de silencio), las manda a cada suscripción
 * web del usuario y las cierra con `cerrar_push()`. Las suscripciones muertas (404/410) se deshabilitan.
 */

import webpush, { WebPushError, type PushSubscription } from "web-push";

import { ConfigError, supabaseAdmin } from "@/features/pagos/server/clients";

type Pending = {
  delivery_id: string;
  title: string;
  body: string;
  action_url: string | null;
  tokens: { id: string; token: string }[] | null;
};

export type PushRun = { tomadas: number; enviadas: number; fallidas: number; tokensDeshabilitados: number };

const BATCH = 100;
const MAX_BATCHES = 5;

let configured = false;
function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new ConfigError("Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://www.entrenamente.io", publicKey, privateKey);
  configured = true;
}

/** Valida el `Authorization: Bearer …` contra el secreto `push_secret` del Vault. */
export async function validDispatchSecret(req: Request): Promise<boolean> {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret) return false;
  const { data, error } = await supabaseAdmin().rpc("push_secreto_valido", { p_secret: secret });
  return !error && data === true;
}

/** Resultado de mandar un aviso a una suscripción. `gone` = el servicio push dice que ya no existe. */
async function sendOne(token: string, payload: string): Promise<{ ok: boolean; gone: boolean; error?: string }> {
  let subscription: PushSubscription;
  try {
    subscription = JSON.parse(token) as PushSubscription;
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) throw new Error();
  } catch {
    return { ok: false, gone: true, error: "suscripción inválida" };
  }
  try {
    await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 24, urgency: "normal" });
    return { ok: true, gone: false };
  } catch (err) {
    if (err instanceof WebPushError) {
      const gone = err.statusCode === 404 || err.statusCode === 410;
      return { ok: false, gone, error: `${err.statusCode} ${err.body || err.message}`.trim() };
    }
    return { ok: false, gone: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Manda todo lo pendiente (hasta MAX_BATCHES × BATCH por llamada; el cron sigue con el resto). */
export async function dispatchPendingPush(): Promise<PushRun> {
  configure();
  const db = supabaseAdmin();
  const run: PushRun = { tomadas: 0, enviadas: 0, fallidas: 0, tokensDeshabilitados: 0 };

  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await db.rpc("tomar_push_pendientes", { p_limite: BATCH });
    if (error) throw new Error(`tomar_push_pendientes: ${error.message}`);
    const pending = (data ?? []) as Pending[];
    run.tomadas += pending.length;

    const gone: string[] = [];
    await Promise.all(
      pending.map(async (p) => {
        const payload = JSON.stringify({ title: p.title, body: p.body, url: p.action_url ?? undefined });
        const results = await Promise.all(
          (p.tokens ?? []).map(async (t) => {
            const r = await sendOne(t.token, payload);
            if (r.gone) gone.push(t.id);
            return r;
          })
        );
        const ok = results.some((r) => r.ok);
        const errorText = ok ? null : results.map((r) => r.error).filter(Boolean).join(" · ") || "sin suscripciones";
        const closed = await db.rpc("cerrar_push", { p_id: p.delivery_id, p_ok: ok, p_error: errorText });
        if (closed.error) console.error("[notificaciones/push] cerrar_push", closed.error.message);
        if (ok) run.enviadas++;
        else run.fallidas++;
      })
    );

    if (gone.length) {
      const { error: disableError } = await db.rpc("deshabilitar_tokens_push", { p_ids: gone });
      if (disableError) console.error("[notificaciones/push] deshabilitar_tokens_push", disableError.message);
      else run.tokensDeshabilitados += gone.length;
    }
    if (pending.length < BATCH) break;
  }
  return run;
}
