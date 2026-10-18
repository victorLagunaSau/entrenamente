/**
 * POST /api/stripe/portal — abre el portal de Stripe para cambiar la tarjeta, ver facturas o cancelar la renovación.
 * Regresa { url } para redirigir; al terminar vuelve a la página de donde salió.
 */

import { stripe, stripeLive, supabaseAdmin, userFromRequest } from "@/features/pagos/server/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return Response.json({ error: "Inicia sesión para continuar." }, { status: 401 });

    const { data } = await supabaseAdmin()
      .from("stripe_customers")
      .select("customer_id")
      .eq("user_id", user.id)
      .eq("livemode", stripeLive())
      .maybeSingle();
    if (!data?.customer_id) return Response.json({ error: "Aún no tienes pagos con tarjeta." }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { returnPath?: string };
    const origin = new URL(req.url).origin;
    const returnPath = body.returnPath?.startsWith("/") ? body.returnPath : "/app/cuenta";

    const configs = await stripe().billingPortal.configurations.list({ active: true, limit: 100 });
    const configuration = configs.data.find((c) => c.metadata?.app === "entrenamente")?.id;

    const portal = await stripe().billingPortal.sessions.create({
      customer: data.customer_id,
      return_url: `${origin}${returnPath}`,
      locale: "es-419",
      configuration,
    });
    return Response.json({ url: portal.url });
  } catch (err) {
    console.error("[stripe/portal]", err);
    return Response.json({ error: "No pudimos abrir el portal. Intenta de nuevo." }, { status: 500 });
  }
}
