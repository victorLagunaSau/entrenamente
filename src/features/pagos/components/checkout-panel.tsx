"use client";

import * as React from "react";
import Link from "next/link";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Banknote, CheckCircle2, CreditCard, ExternalLink, Landmark, Loader2, ShieldCheck, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMxn, INTERVAL_LABEL, type BillingInterval } from "@/features/pricing/lib/pricing";
import { cn } from "@/lib/utils";

import type { CheckoutRequest, PayMethod, Quote, SessionStatus } from "../lib/types";
import { checkout, sessionStatus } from "../services/pagos-service";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= publishableKey ? loadStripe(publishableKey, { locale: "es-419" }) : null);

type Phase =
  | { kind: "loading" }
  | { kind: "disabled" }
  | { kind: "blocked"; message: string }
  | { kind: "ready"; quote: Quote }
  | { kind: "checking"; quote: Quote }
  | { kind: "done"; quote: Quote; result: SessionStatus };

const METHODS: { id: PayMethod; label: string; icon: typeof CreditCard }[] = [
  { id: "card", label: "Tarjeta de crédito o débito", icon: CreditCard },
  { id: "oxxo", label: "Efectivo en OXXO", icon: Store },
  { id: "spei", label: "Transferencia SPEI", icon: Landmark },
];

function methodHint(method: PayMethod, quote: Quote) {
  const per = INTERVAL_LABEL[quote.billing_cycle].per;
  if (method === "card") {
    return quote.one_time_only
      ? "Pago único de esta oferta."
      : `Se renueva sola cada ${per}. Cancela cuando quieras desde tu cuenta.`;
  }
  if (method === "oxxo") return "Te damos una ficha para pagar en cualquier OXXO (vence en 3 días). Pagas solo este periodo.";
  return "Te damos una CLABE para transferir desde tu banco. Pagas solo este periodo.";
}

/**
 * Cobro con Stripe en un modal (Checkout embebido). Cotiza en el servidor al cargar —el total, la oferta y si
 * puede comprar— y al pagar abre el formulario seguro de Stripe sin salir de la página.
 */
export function CheckoutPanel({
  request,
  onQuote,
}: {
  request: Omit<CheckoutRequest, "metodo" | "preview">;
  onQuote?: (quote: Quote) => void;
}) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });
  const [method, setMethod] = React.useState<PayMethod>("card");
  const [open, setOpen] = React.useState(false);
  const [openError, setOpenError] = React.useState<string | null>(null);
  const sessionId = React.useRef<string | null>(null);
  const key = JSON.stringify(request);

  React.useEffect(() => {
    let active = true;
    setPhase({ kind: "loading" });
    checkout({ ...JSON.parse(key), preview: true })
      .then((res) => {
        if (!active) return;
        if (!res.enabled || !getStripe()) return setPhase({ kind: "disabled" });
        setPhase({ kind: "ready", quote: res.quote });
        onQuote?.(res.quote);
      })
      .catch((err: Error) => active && setPhase({ kind: "blocked", message: err.message }));
    return () => {
      active = false;
    };
    // onQuote es del padre; solo se vuelve a cotizar si cambia lo que se compra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const fetchClientSecret = React.useCallback(async () => {
    setOpenError(null);
    try {
      const res = await checkout({ ...JSON.parse(key), metodo: method });
      if (!res.enabled || !res.clientSecret) throw new Error("El pago en línea no está disponible por ahora.");
      sessionId.current = res.sessionId ?? null;
      return res.clientSecret;
    } catch (err) {
      setOpenError((err as Error).message);
      throw err;
    }
  }, [key, method]);

  const onComplete = React.useCallback(() => {
    setOpen(false);
    if (phase.kind !== "ready" || !sessionId.current) return;
    const quote = phase.quote;
    setPhase({ kind: "checking", quote });
    const id = sessionId.current;
    // El webhook puede tardar unos segundos: se consulta la sesión (que también activa el acceso si ya está pagada).
    const poll = async (attempt: number): Promise<void> => {
      try {
        const result = await sessionStatus(id);
        if (result.paid || result.instructionsUrl || attempt >= 4) return setPhase({ kind: "done", quote, result });
      } catch {
        if (attempt >= 4) return setPhase({ kind: "done", quote, result: { status: "complete", paid: false, method, instructionsUrl: null, expiresAt: null } });
      }
      await new Promise((r) => setTimeout(r, 1500));
      return poll(attempt + 1);
    };
    void poll(0);
  }, [phase, method]);

  if (phase.kind === "loading") {
    return <Loader2 className="mx-auto size-6 animate-spin text-brand-light motion-reduce:animate-none" aria-label="Cargando" />;
  }

  if (phase.kind === "disabled") {
    return (
      <>
        <p className="flex gap-3 rounded-xl bg-secondary/10 p-4 text-sm text-cool">
          <ShieldCheck className="size-5 shrink-0 text-secondary" aria-hidden />
          <span>
            <strong className="text-foreground">El pago en línea se habilita muy pronto.</strong> Ya guardamos tu elección;
            te avisaremos en cuanto puedas completar tu compra.
          </span>
        </p>
        <Button variant="brand" size="lg" disabled>
          Pagar
        </Button>
      </>
    );
  }

  if (phase.kind === "blocked") {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="rounded-xl bg-muted/60 p-4 text-sm text-cool">
          {phase.message}
        </p>
        <Button asChild variant="outline">
          <Link href="/app/cuenta">Ir a Mi cuenta</Link>
        </Button>
      </div>
    );
  }

  if (phase.kind === "checking") {
    return (
      <p className="flex items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm text-cool" role="status">
        <Loader2 className="size-5 animate-spin text-brand-light motion-reduce:animate-none" aria-hidden />
        Confirmando tu pago…
      </p>
    );
  }

  if (phase.kind === "done") return <PaymentResult quote={phase.quote} result={phase.result} />;

  const { quote } = phase;
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">¿Cómo quieres pagar?</legend>
        {METHODS.map((m) => (
          <label
            key={m.id}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
              method === m.id ? "border-brand-light bg-brand-light/10" : "hover:bg-muted/50"
            )}
          >
            <input
              type="radio"
              name="metodo"
              value={m.id}
              checked={method === m.id}
              onChange={() => setMethod(m.id)}
              className="sr-only"
            />
            <m.icon className={cn("mt-0.5 size-5 shrink-0", method === m.id ? "text-brand-light" : "text-muted-foreground")} aria-hidden />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{m.label}</span>
              <span className="text-xs text-muted-foreground">{methodHint(m.id, quote)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {quote.discount_kept && quote.discount_pct && (
        <p className="text-sm text-energy">Conservas tu {Number(quote.discount_pct)} % de descuento por seguir con nosotros.</p>
      )}

      <Button variant="brand" size="lg" onClick={() => setOpen(true)}>
        Pagar {formatMxn(Number(quote.total))}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Precio con IVA incluido. Pago seguro procesado por Stripe; nunca vemos los datos de tu tarjeta.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{quote.plan_name}</DialogTitle>
            <DialogDescription>
              {formatMxn(Number(quote.total))} MXN · {periodText(quote.billing_cycle, method, quote.one_time_only)}
            </DialogDescription>
          </DialogHeader>
          {openError ? (
            <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
              {openError}
            </p>
          ) : (
            open && (
              // shrink-0: dentro del modal (flex-col con scroll) el formulario de Stripe no debe encogerse y recortarse;
              // crece a su altura y el modal es el que se desplaza (en el celular no se podía bajar al botón de pagar).
              <div className="min-h-80 shrink-0 overflow-hidden rounded-xl bg-white">
                <EmbeddedCheckoutProvider key={method} stripe={getStripe()} options={{ fetchClientSecret, onComplete }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function periodText(cycle: BillingInterval, method: PayMethod, oneTime: boolean) {
  if (method === "card" && !oneTime) return `se renueva cada ${INTERVAL_LABEL[cycle].per}`;
  return `pago de un ${INTERVAL_LABEL[cycle].per}`;
}

function PaymentResult({ quote, result }: { quote: Quote; result: SessionStatus }) {
  const home = quote.target_role === "parent" ? "/app/dashboard" : "/app/student/home";

  if (result.paid) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-secondary/10 p-6 text-center" role="status">
        <CheckCircle2 className="size-10 text-secondary" aria-hidden />
        <p className="text-xl font-bold">¡Listo! Tu acceso ilimitado está activo.</p>
        <p className="text-sm text-cool">Stripe te envía el comprobante del pago a tu correo.</p>
        <Button asChild variant="brand" size="lg" className="mt-2 w-full">
          <Link href={home}>Empezar ahora</Link>
        </Button>
      </div>
    );
  }

  if (result.instructionsUrl) {
    const oxxo = result.method === "oxxo";
    const until = result.expiresAt
      ? new Date(result.expiresAt).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
      : null;
    return (
      <div className="flex flex-col gap-3 rounded-2xl border p-5" role="status">
        <p className="flex items-center gap-2 text-lg font-bold">
          {oxxo ? <Store className="size-5 text-energy" aria-hidden /> : <Banknote className="size-5 text-energy" aria-hidden />}
          {oxxo ? "Tu ficha de OXXO está lista" : "Tus datos para transferir están listos"}
        </p>
        <p className="text-sm text-cool">
          {oxxo
            ? `Paga ${formatMxn(Number(quote.total))} en cualquier OXXO${until ? ` antes del ${until}` : ""}. Tu acceso se activa solo en cuanto OXXO confirme el pago (normalmente en unas horas).`
            : `Transfiere ${formatMxn(Number(quote.total))} desde tu banco a la CLABE que te damos. Tu acceso se activa solo en cuanto llegue la transferencia.`}
        </p>
        <Button asChild variant="brand" size="lg">
          <a href={result.instructionsUrl} target="_blank" rel="noreferrer">
            {oxxo ? "Ver mi ficha" : "Ver datos de transferencia"} <ExternalLink />
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-5" role="status">
      <p className="font-semibold">Estamos confirmando tu pago.</p>
      <p className="text-sm text-cool">Tu acceso se activa en cuanto Stripe nos lo confirme. Puedes revisar en unos minutos.</p>
      <Button asChild variant="outline">
        <Link href={home}>Ir a mi inicio</Link>
      </Button>
    </div>
  );
}
