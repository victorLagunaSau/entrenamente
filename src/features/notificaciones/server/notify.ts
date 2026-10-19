/**
 * Centro de notificaciones del lado del servidor (rutas /api/*). Nunca se importa desde el navegador.
 *   · notify()            llama a `notificar()`: bandeja In-App + correo pendiente según el catálogo y las preferencias.
 *   · sendPendingEmails() manda por Resend los correos pendientes (los toma con `tomar_correos_pendientes`, así dos
 *                         despachadores al mismo tiempo no mandan el mismo correo).
 * Variables: RESEND_API_KEY, NOTIFICATIONS_EMAIL_FROM (dominio verificado en Resend; si falta, SUPPORT_EMAIL_FROM).
 */

import { supabaseAdmin } from "@/features/pagos/server/clients";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.entrenamente.io").replace(/\/$/, "");
const FROM =
  process.env.NOTIFICATIONS_EMAIL_FROM || process.env.SUPPORT_EMAIL_FROM || "Entrena Mente <onboarding@resend.dev>";

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

type PendingEmail = {
  delivery_id: string;
  email: string;
  nombre: string | null;
  event_code: string;
  title: string;
  body: string;
  action_url: string | null;
};

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render(m: PendingEmail) {
  const link = `${SITE_URL}${m.action_url ?? "/login"}`;
  const hola = m.nombre ? `Hola, ${m.nombre}:` : "Hola:";
  const settings = `${SITE_URL}/app/cuenta?tab=configuracion`;
  return {
    subject: m.title,
    text: `${hola}\n\n${m.body}\n\nAbrir Entrena Mente: ${link}\n\n—\nElige qué avisos recibir: ${settings}`,
    html:
      `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">` +
      `<p>${escape(hola)}</p><h2 style="font-size:20px;margin:16px 0 8px">${escape(m.title)}</h2>` +
      `<p style="line-height:1.5">${escape(m.body)}</p>` +
      `<p style="margin:24px 0"><a href="${link}" style="background:#1590d6;color:#fff;padding:10px 18px;border-radius:10px;` +
      `text-decoration:none;font-weight:600">Abrir Entrena Mente</a></p>` +
      `<p style="font-size:12px;color:#64748b">Recibes este correo por tu cuenta en Entrena Mente. ` +
      `<a href="${settings}" style="color:#64748b">Elige qué avisos recibir</a>.</p></div>`,
  };
}

/** Manda hasta `limit` correos pendientes. Sin RESEND_API_KEY no hace nada (quedan pendientes para después). */
export async function sendPendingEmails(limit = 50): Promise<{ sent: number; failed: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, failed: 0 };

  const db = supabaseAdmin();
  const { data, error } = await db.rpc("tomar_correos_pendientes", { p_limite: limit });
  if (error) throw new Error(`tomar_correos_pendientes: ${error.message}`);

  let sent = 0;
  let failed = 0;
  for (const m of (data ?? []) as PendingEmail[]) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        // Resend no repite un envío con la misma llave (reintentos del despachador).
        "idempotency-key": `notif-${m.delivery_id}`,
      },
      body: JSON.stringify({ from: FROM, to: [m.email], ...render(m), tags: [{ name: "evento", value: m.event_code }] }),
    }).catch((e: unknown) => e as Error);

    const ok = res instanceof Response && res.ok;
    const payload = res instanceof Response ? await res.json().catch(() => null) : null;
    const errorText = ok ? null : res instanceof Response ? `${res.status} ${JSON.stringify(payload)}` : String(res);
    if (ok) sent++;
    else {
      failed++;
      console.error("[notificaciones] Resend", m.event_code, errorText);
    }
    await db.rpc("cerrar_entrega", {
      p_id: m.delivery_id,
      p_ok: ok,
      p_provider_id: (payload as { id?: string } | null)?.id ?? null,
      p_error: errorText,
    });
  }
  return { sent, failed };
}
