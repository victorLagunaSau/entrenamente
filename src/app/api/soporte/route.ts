/**
 * POST /api/soporte — formulario de contacto de /soporte. Envía el mensaje por correo con Resend
 * (RESEND_API_KEY) a SUPPORT_EMAIL_TO, con reply-to al correo de quien escribe.
 * Acepta llamadas de la app nativa (otro origen), por eso responde CORS.
 */

import { TOPICS } from "@/features/soporte/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TO = process.env.SUPPORT_EMAIL_TO || "viktor.laguna@gmail.com";
const FROM = process.env.SUPPORT_EMAIL_FROM || "Entrena Mente Soporte <onboarding@resend.dev>";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Solicitud inválida." }, 400);

  // Honeypot: los bots llenan el campo oculto; se responde OK sin enviar nada.
  if (typeof body.website === "string" && body.website) return json({ ok: true });

  const str = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const name = str("name", 120);
  const email = str("email", 200);
  const topic = TOPICS.includes(str("topic", 60) as (typeof TOPICS)[number]) ? str("topic", 60) : "Otro";
  const message = str("message", 5000);

  if (!name) return json({ error: "Escribe tu nombre." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Escribe un correo válido." }, 400);
  if (message.length < 10) return json({ error: "Cuéntanos un poco más (mínimo 10 caracteres)." }, 400);

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[soporte] Falta RESEND_API_KEY");
    return json({ error: "El formulario no está disponible por ahora.", fallback: TO }, 503);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: email,
      subject: `[Soporte] ${topic} — ${name}`,
      text: `De: ${name} <${email}>\nTema: ${topic}\n\n${message}`,
      html: `<p><b>De:</b> ${escape(name)} &lt;${escape(email)}&gt;<br><b>Tema:</b> ${escape(topic)}</p><p style="white-space:pre-wrap">${escape(message)}</p>`,
    }),
  }).catch((err) => {
    console.error("[soporte]", err);
    return null;
  });

  if (!res?.ok) {
    if (res) console.error("[soporte] Resend", res.status, await res.text().catch(() => ""));
    return json({ error: "No pudimos enviar tu mensaje. Intenta de nuevo.", fallback: TO }, 502);
  }
  return json({ ok: true });
}
