/**
 * Activación del acceso cuando Stripe confirma un pago. La usan el webhook y la consulta de la sesión al cerrar
 * el modal (lo que llegue primero); `stripe_registrar_pago` es idempotente por sesión y por factura.
 */

import type Stripe from "stripe";

import { payCode } from "../lib/pay-code";
import type { PayMethod, Quote } from "../lib/types";
import { stripe, supabaseAdmin } from "./clients";

/** Lo que viaja en la metadata de la sesión, del pago y de la suscripción. Todo texto (límite de Stripe). */
export type PayMetadata = {
  user_id: string;
  plan_id: string;
  billing_cycle: string;
  seats: string;
  duration_days: string;
  assigned_variant: string;
  experiment_id: string;
  flash_sale_id: string;
  method: PayMethod;
  /** Clave corta del pago: plan, periodo y descuento (ver `payCode`). */
  code: string;
  /** Descripción del pago en el Dashboard de Stripe (ver `conceptFor`). */
  concept: string;
  /** Nombre de la oferta aplicada, si hubo. */
  sale_title: string;
};

const CYCLE_LABEL: Record<string, string> = { monthly: "Mensual", quarterly: "Trimestral", annual: "Anual" };

/** "EST-M-40 · Plan Estudiante · Mensual · 40 % desc." */
export function conceptFor(quote: Quote) {
  const parts = [payCode(quote), quote.plan_name];
  if (quote.per_student) parts.push(`${quote.seats} estudiantes`);
  parts.push(CYCLE_LABEL[quote.billing_cycle] ?? quote.billing_cycle);
  if (quote.discount_pct) parts.push(`${quote.discount_pct} % desc.`);
  return parts.join(" · ");
}

export const metadataFor = (userId: string, quote: Quote, method: PayMethod): PayMetadata => ({
  user_id: userId,
  plan_id: quote.plan_id,
  billing_cycle: quote.billing_cycle,
  seats: String(quote.seats),
  duration_days: String(quote.duration_days),
  assigned_variant: quote.assigned_variant ?? "",
  experiment_id: quote.experiment_id ?? "",
  flash_sale_id: quote.flash_sale_id ?? "",
  method,
  code: payCode(quote),
  concept: conceptFor(quote),
  sale_title: (quote.sale_title ?? "").slice(0, 200),
});

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

async function registrar(payload: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin().rpc("stripe_registrar_pago", { p: payload });
  if (error) throw new Error(`stripe_registrar_pago: ${error.message}`);
  return data as { receipt_code: string; license_expires_at: string };
}

/** Pago único (OXXO, SPEI u oferta de precio fijo). En suscripciones, activa con la primera factura. */
export async function fulfillSession(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return null;
  const meta = session.metadata as PayMetadata | null;
  if (!meta?.user_id) return null;

  if (session.mode === "subscription") {
    const subId = idOf(session.subscription);
    if (!subId) return null;
    const sub = await stripe().subscriptions.retrieve(subId, { expand: ["latest_invoice"] });
    await syncSubscription(sub);
    const invoice = sub.latest_invoice;
    return invoice && typeof invoice !== "string" && invoice.status === "paid" ? fulfillInvoice(invoice) : null;
  }

  const paymentIntent = idOf(session.payment_intent);
  const result = await registrar({
    ...meta,
    amount: (session.amount_total ?? 0) / 100,
    auto_renew: false,
    session_id: session.id,
    payment_intent_id: paymentIntent,
    customer_id: idOf(session.customer),
  });
  await labelPayment(paymentIntent, meta.concept, result.receipt_code);
  return result;
}

/** Factura pagada de una suscripción con tarjeta: la primera y cada renovación. */
export async function fulfillInvoice(invoice: Stripe.Invoice) {
  const details = invoice.parent?.subscription_details;
  const subId = idOf(details?.subscription);
  const meta = details?.metadata as PayMetadata | null | undefined;
  if (!subId || !meta?.user_id || invoice.amount_paid <= 0) return null;

  const periodEnd = Math.max(...invoice.lines.data.map((l) => l.period.end));
  const quantity = invoice.lines.data.find((l) => l.quantity)?.quantity;
  const paymentIntent = await invoicePaymentIntent(invoice.id!);
  const result = await registrar({
    ...meta,
    // En Familia la cantidad de la factura manda (por si cambió en el portal).
    seats: meta.plan_id === "familia" && quantity ? String(quantity) : meta.seats,
    amount: invoice.amount_paid / 100,
    period_end: Number.isFinite(periodEnd) ? periodEnd : null,
    method: "card",
    auto_renew: true,
    invoice_id: invoice.id,
    payment_intent_id: paymentIntent,
    subscription_id: subId,
    customer_id: idOf(invoice.customer),
  });
  const concept = invoice.billing_reason === "subscription_cycle" ? `${meta.concept} · renovación` : meta.concept;
  await labelPayment(paymentIntent, concept, result.receipt_code);
  return result;
}

/** Pago (pi_…) de una factura: lo que sale en el Dashboard y en los reclamos del banco. */
async function invoicePaymentIntent(invoiceId: string) {
  try {
    const { data } = await stripe().invoicePayments.list({ invoice: invoiceId, limit: 1 });
    return idOf(data[0]?.payment.payment_intent);
  } catch (err) {
    console.error("[stripe] pago de la factura", err);
    return null;
  }
}

/**
 * Pone en el pago de Stripe la clave del plan y el recibo (Stripe muestra "Subscription creation" en las
 * suscripciones). Es solo informativo: si falla, el pago ya quedó registrado.
 */
async function labelPayment(paymentIntent: string | null, concept: string | undefined, receipt: string) {
  if (!paymentIntent || !concept) return;
  try {
    await stripe().paymentIntents.update(paymentIntent, {
      description: `${concept} · ${receipt}`,
      metadata: { receipt_code: receipt },
    });
  } catch (err) {
    console.error("[stripe] descripción del pago", err);
  }
}

/** Estado de la suscripción (activa, se cancela al final del periodo, terminada). */
export async function syncSubscription(sub: Stripe.Subscription) {
  const meta = sub.metadata as Partial<PayMetadata>;
  if (!meta.user_id || !meta.plan_id || !meta.billing_cycle) return;
  const item = sub.items.data[0];
  const { error } = await supabaseAdmin().rpc("stripe_guardar_suscripcion", {
    p_id: sub.id,
    p_user: meta.user_id,
    p_plan: meta.plan_id,
    p_ciclo: meta.billing_cycle,
    p_seats: item?.quantity ?? Number(meta.seats ?? 1),
    p_status: sub.status,
    p_cancel_at_period_end: sub.cancel_at_period_end || sub.cancel_at != null,
    p_period_end: item?.current_period_end ?? null,
  });
  if (error) throw new Error(`stripe_guardar_suscripcion: ${error.message}`);
}
