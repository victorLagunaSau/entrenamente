/**
 * GET /api/stripe/session?id=cs_… — estado del pago al cerrar el modal.
 * Si ya está pagado, activa el acceso en ese momento (sin esperar al webhook; los dos son idempotentes).
 * OXXO y SPEI quedan pendientes: regresa la ficha o las instrucciones con la CLABE.
 */

import type Stripe from "stripe";

import type { PayMethod, SessionStatus } from "@/features/pagos/lib/types";
import { stripe, userFromRequest } from "@/features/pagos/server/clients";
import { fulfillSession } from "@/features/pagos/server/fulfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return Response.json({ error: "Inicia sesión para continuar." }, { status: 401 });

    const id = new URL(req.url).searchParams.get("id");
    if (!id?.startsWith("cs_")) return Response.json({ error: "Falta la sesión." }, { status: 400 });

    const session = await stripe().checkout.sessions.retrieve(id, { expand: ["payment_intent"] });
    if (session.metadata?.user_id !== user.id) return Response.json({ error: "Sesión no encontrada." }, { status: 404 });

    const paid = session.payment_status === "paid";
    if (paid) await fulfillSession(session);

    const intent = session.payment_intent as Stripe.PaymentIntent | null;
    const next = intent?.next_action;
    const instructionsUrl =
      next?.oxxo_display_details?.hosted_voucher_url ?? next?.display_bank_transfer_instructions?.hosted_instructions_url ?? null;
    const oxxoExpires = next?.oxxo_display_details?.expires_after;

    return Response.json({
      status: session.status ?? "open",
      paid,
      method: (session.metadata?.method as PayMethod) ?? "card",
      instructionsUrl: paid ? null : instructionsUrl,
      expiresAt: !paid && oxxoExpires ? new Date(oxxoExpires * 1000).toISOString() : null,
    } satisfies SessionStatus);
  } catch (err) {
    console.error("[stripe/session]", err);
    return Response.json({ error: "No pudimos revisar tu pago. Recarga la página." }, { status: 500 });
  }
}
