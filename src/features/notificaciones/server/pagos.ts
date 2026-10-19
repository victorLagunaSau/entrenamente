/**
 * Avisos de pagos que nacen en Stripe (el resto de los avisos de pago salen de la base: P1, P7, P9, P10, P11).
 *   · P4 checkout.session.async_payment_failed   OXXO / SPEI no se pagó a tiempo
 *   · P5 invoice.payment_failed                  la tarjeta rechazó la renovación
 *   · P8 invoice.upcoming                        aviso del próximo cargo automático
 * Todos llevan a Mi cuenta, donde está la sección de suscripción.
 */

import type Stripe from "stripe";

import type { PayMetadata } from "@/features/pagos/server/fulfill";

import { notify } from "./notify";

const ACCOUNT_URL = "/app/cuenta";

const money = (cents: number, currency = "mxn") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

const day = (unix: number) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" }).format(unix * 1000);

const invoiceMeta = (invoice: Stripe.Invoice) =>
  invoice.parent?.subscription_details?.metadata as Partial<PayMetadata> | null | undefined;

const subscriptionId = (invoice: Stripe.Invoice) => {
  const sub = invoice.parent?.subscription_details?.subscription;
  return typeof sub === "string" ? sub : (sub?.id ?? "");
};

/** P5: un aviso por factura y por intento. */
export async function notifyPaymentFailed(invoice: Stripe.Invoice) {
  const meta = invoiceMeta(invoice);
  if (!meta?.user_id) return;
  const retry = invoice.next_payment_attempt ? ` Lo intentaremos de nuevo el ${day(invoice.next_payment_attempt)}.` : "";
  await notify(meta.user_id, "P5", {
    title: "Tu tarjeta rechazó el pago de tu plan",
    body: `No pudimos cobrar ${money(invoice.amount_due, invoice.currency)}.${retry} Actualiza tu tarjeta para no perder el acceso Pro.`,
    url: ACCOUNT_URL,
    dedupe: `P5:${invoice.id}:${invoice.attempt_count}`,
  });
}

/** P8: la factura próxima aún no tiene id; la clave es la suscripción y la fecha del cargo. */
export async function notifyUpcoming(invoice: Stripe.Invoice) {
  const meta = invoiceMeta(invoice);
  const when = invoice.next_payment_attempt ?? invoice.period_end;
  if (!meta?.user_id || !when || invoice.amount_due <= 0) return;
  await notify(meta.user_id, "P8", {
    title: `Tu plan se renueva el ${day(when)}`,
    body: `Cargaremos ${money(invoice.amount_due, invoice.currency)} a tu tarjeta. Si quieres cambiar algo, hazlo antes desde Mi cuenta.`,
    url: ACCOUNT_URL,
    dedupe: `P8:${subscriptionId(invoice)}:${when}`,
  });
}

/** P4: la ficha de OXXO o la referencia SPEI venció sin pagarse. */
export async function notifyAsyncPaymentFailed(session: Stripe.Checkout.Session) {
  const meta = session.metadata as Partial<PayMetadata> | null;
  if (!meta?.user_id) return;
  const method = meta.method === "spei" ? "la transferencia SPEI" : "la ficha de OXXO";
  await notify(meta.user_id, "P4", {
    title: "Tu pago no se completó",
    body: `No recibimos el pago de ${method}. Puedes generar una nueva o pagar con tarjeta cuando quieras.`,
    url: "/pricing",
    dedupe: `P4:${session.id}`,
  });
}
