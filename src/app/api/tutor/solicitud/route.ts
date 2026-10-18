/**
 * POST /api/tutor/solicitud — correo al tutor cuando su estudiante le pide activar o renovar el plan.
 * La solicitud ya quedó registrada (aviso en el panel) con `solicitar_plan_tutor`; aquí solo se envía el correo
 * de esas solicitudes recién creadas, una vez. Sin RESEND_API_KEY el aviso en el panel basta.
 */

import { supabaseAdmin, userFromRequest } from "@/features/pagos/server/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.entrenamente.io").replace(/\/$/, "");
const FROM = process.env.SUPPORT_EMAIL_FROM || "Entrena Mente <onboarding@resend.dev>";

const json = (body: unknown, status = 200) => Response.json(body, { status });

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Mail = { email: string; tutor: string; estudiante: string };

export async function POST(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Inicia sesión para continuar." }, 401);

    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids) ? body.ids.filter((n): n is number => Number.isInteger(n)).slice(0, 20) : [];
    if (!ids.length) return json({ sent: 0 });

    const key = process.env.RESEND_API_KEY;
    if (!key) return json({ sent: 0 });

    const { data, error } = await supabaseAdmin().rpc("correo_solicitudes_tutor", { p_estudiante: user.id, p_ids: ids });
    if (error) throw error;

    const link = `${SITE_URL}/app/dashboard/billing`;
    let sent = 0;
    for (const m of (data ?? []) as Mail[]) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [m.email],
          subject: `${m.estudiante} te pide activar su plan en Entrena Mente`,
          text:
            `Hola, ${m.tutor}:\n\n${m.estudiante} te solicita activar o renovar la suscripción de su cuenta en ` +
            `Entrena Mente para continuar con sus simulacros.\n\nRevisa tu plan aquí: ${link}`,
          html:
            `<p>Hola, ${escape(m.tutor)}:</p><p><b>${escape(m.estudiante)}</b> te solicita activar o renovar la ` +
            `suscripción de su cuenta en Entrena Mente para continuar con sus simulacros.</p>` +
            `<p><a href="${link}">Revisar mi plan</a></p>`,
        }),
      }).catch(() => null);
      if (res?.ok) sent++;
      else console.error("[tutor/solicitud] Resend", res?.status, await res?.text().catch(() => ""));
    }
    return json({ sent });
  } catch (err) {
    console.error("[tutor/solicitud]", err);
    return json({ error: "No pudimos enviar el correo." }, 500);
  }
}
