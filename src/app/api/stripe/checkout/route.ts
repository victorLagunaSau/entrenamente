/**
 * POST /api/stripe/checkout — cotiza y abre el pago embebido de Stripe.
 * El precio sale de Supabase (`stripe_cotizar`: variante A/B, oferta, Familia por estudiante), nunca del navegador.
 *   · card: suscripción que se renueva sola (o pago único si la oferta es de precio fijo).
 *   · oxxo / spei: pago único del periodo; antes de vencer, la web avisa para renovar.
 */

import type Stripe from "stripe";

import type { CheckoutRequest, CheckoutResponse, PayMethod, Quote } from "@/features/pagos/lib/types";
import { ConfigError, stripe, stripeEnabled, stripeLive, supabaseAdmin, userFromRequest } from "@/features/pagos/server/clients";
import { metadataFor } from "@/features/pagos/server/fulfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS: PayMethod[] = ["card", "oxxo", "spei"];

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  if (!stripeEnabled()) return json({ enabled: false } satisfies CheckoutResponse);

  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Inicia sesión para continuar." }, 401);

    const body = (await req.json().catch(() => null)) as CheckoutRequest | null;
    if (!body?.plan || !body.periodo) return json({ error: "Falta el plan o el periodo." }, 400);

    // Estudiante vinculado a un tutor: no compra; se lo pide a su tutor (toda la facturación vive en el tutor).
    const { data: linked } = await supabaseAdmin()
      .from("tutor_students")
      .select("owner_id")
      .eq("student_id", user.id)
      .limit(1);
    if (linked?.length) {
      return json({ error: "Tu cuenta está vinculada a tu tutor: pídele que active o renueve tu plan." }, 409);
    }

    const { data, error } = await supabaseAdmin().rpc("stripe_cotizar", {
      p_user: user.id,
      p_plan: body.plan,
      p_ciclo: body.periodo,
      p_estudiantes: body.estudiantes ?? null,
      p_oferta: body.oferta || null,
    });
    // Los errores de la cotización ya traen el mensaje para la persona.
    if (error) return json({ error: error.message }, error.code === "P0002" || error.code === "22023" ? 409 : 500);
    const quote = data as Quote;

    if (body.preview) return json({ enabled: true, quote } satisfies CheckoutResponse);

    const method = METHODS.includes(body.metodo as PayMethod) ? (body.metodo as PayMethod) : "card";
    const session = await createSession(user.id, user.email ?? null, quote, method);
    return json({
      enabled: true,
      quote,
      clientSecret: session.client_secret ?? undefined,
      sessionId: session.id,
    } satisfies CheckoutResponse);
  } catch (err) {
    console.error("[stripe/checkout]", err);
    if (err instanceof ConfigError) return json({ enabled: false } satisfies CheckoutResponse);
    return json({ error: "No pudimos abrir el pago. Intenta de nuevo en un momento." }, 500);
  }
}

/** Cliente de Stripe del usuario (uno por cuenta y modo; SPEI lo necesita para darle su CLABE). */
async function customerFor(userId: string, email: string | null) {
  const admin = supabaseAdmin();
  const livemode = stripeLive();
  const { data } = await admin
    .from("stripe_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .eq("livemode", livemode)
    .maybeSingle();
  if (data?.customer_id) return data.customer_id as string;

  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const customer = await stripe().customers.create(
    { email: email ?? undefined, name: profile?.full_name || undefined, metadata: { user_id: userId } },
    { idempotencyKey: `customer-${userId}` }
  );
  await admin.from("stripe_customers").upsert({ user_id: userId, customer_id: customer.id, livemode });
  return customer.id;
}

/** Precio del catálogo (scripts/stripe-setup.mjs) si coincide con lo cotizado; si no, el monto exacto de Supabase. */
async function recurringLine(quote: Quote): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
  const lookup = `${quote.plan_id}_${quote.billing_cycle}`;
  const cents = Math.round(quote.unit_price * 100);
  if (quote.unit_price === quote.unit_regular) {
    const { data } = await stripe().prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
    if (data[0]?.unit_amount === cents) return { price: data[0].id, quantity: quote.quantity };
  }
  // Con oferta: el precio rebajado queda en la suscripción y se conserva en cada renovación.
  return {
    price_data: {
      currency: "mxn",
      product: `plan_${quote.plan_id}`,
      unit_amount: cents,
      tax_behavior: "inclusive",
      recurring: {
        interval: quote.billing_cycle === "annual" ? "year" : "month",
        interval_count: quote.billing_cycle === "quarterly" ? 3 : 1,
      },
    },
    quantity: quote.quantity,
  };
}

async function createSession(userId: string, email: string | null, quote: Quote, method: PayMethod) {
  const customer = await customerFor(userId, email);
  const metadata = metadataFor(userId, quote, method);
  const subscription = method === "card" && !quote.one_time_only;
  const taxRates = process.env.STRIPE_TAX_RATE_IVA ? [process.env.STRIPE_TAX_RATE_IVA] : undefined;

  const line: Stripe.Checkout.SessionCreateParams.LineItem = subscription
    ? await recurringLine(quote)
    : {
        price_data: {
          currency: "mxn",
          product: `plan_${quote.plan_id}`,
          unit_amount: Math.round(quote.unit_price * 100),
          tax_behavior: "inclusive",
        },
        quantity: quote.quantity,
      };

  const params: Stripe.Checkout.SessionCreateParams = {
    ui_mode: "embedded_page",
    redirect_on_completion: "never",
    locale: "es-419",
    customer,
    client_reference_id: userId,
    line_items: [{ ...line, tax_rates: taxRates }],
    metadata,
  };

  if (subscription) {
    params.mode = "subscription";
    params.allowed_payment_method_types = ["card"];
    params.subscription_data = { metadata, description: metadata.concept };
  } else {
    params.mode = "payment";
    params.payment_intent_data = { metadata, description: metadata.concept };
    if (method === "oxxo") {
      params.allowed_payment_method_types = ["oxxo"];
      params.payment_method_options = { oxxo: { expires_after_days: 3 } };
    } else if (method === "spei") {
      params.allowed_payment_method_types = ["customer_balance"];
      params.payment_method_options = {
        customer_balance: { funding_type: "bank_transfer", bank_transfer: { type: "mx_bank_transfer" } },
      };
    } else {
      params.allowed_payment_method_types = ["card"];
    }
  }

  return stripe().checkout.sessions.create(params);
}
