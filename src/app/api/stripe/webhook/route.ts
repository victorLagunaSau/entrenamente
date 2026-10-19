/**
 * POST /api/stripe/webhook — eventos de Stripe, con la firma validada (STRIPE_WEBHOOK_SECRET).
 *   · checkout.session.completed            tarjeta pagada al momento (OXXO / SPEI llegan "unpaid")
 *   · checkout.session.async_payment_*      OXXO / SPEI pagados (o vencidos: aviso P4)
 *   · invoice.paid                          primera factura y cada renovación de la suscripción
 *   · invoice.payment_failed / upcoming     avisos P5 (tarjeta rechazada) y P8 (próximo cargo)
 *   · customer.subscription.*               cancelaciones, cobros fallidos, fin de la suscripción
 * Responde 500 si algo falla para que Stripe reintente; todo lo que hace es idempotente.
 */

import type Stripe from "stripe";

import { stripe, supabaseAdmin } from "@/features/pagos/server/clients";
import { fulfillInvoice, fulfillSession, syncSubscription } from "@/features/pagos/server/fulfill";
import { notifyAsyncPaymentFailed, notifyPaymentFailed, notifyUpcoming } from "@/features/notificaciones/server/pagos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook sin configurar", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch (err) {
    console.error("[stripe/webhook] firma inválida", err);
    return new Response("Firma inválida", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await fulfillSession(event.data.object);
        break;
      case "checkout.session.async_payment_failed":
        await notifyAsyncPaymentFailed(event.data.object);
        break;
      case "invoice.paid":
        await fulfillInvoice(event.data.object);
        break;
      case "invoice.payment_failed":
        await notifyPaymentFailed(event.data.object);
        break;
      case "invoice.upcoming":
        await notifyUpcoming(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      default:
        break;
    }
    await supabaseAdmin().from("stripe_events").upsert({ id: event.id, type: event.type }, { ignoreDuplicates: true });
    return Response.json({ received: true });
  } catch (err) {
    console.error(`[stripe/webhook] ${event.type} ${event.id}`, err);
    return new Response("Error al procesar", { status: 500 });
  }
}
