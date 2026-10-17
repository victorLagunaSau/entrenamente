"use client";

import * as React from "react";
import Link from "next/link";
import { CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Section } from "@/features/cuenta/components/parts";

import { myRenewal, openBillingPortal, type Renewal } from "../services/pagos-service";

const METHOD_LABEL = { card: "Tarjeta", oxxo: "Efectivo en OXXO", spei: "Transferencia SPEI" } as const;
const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });

/** Mi cuenta → "Tu suscripción": vigencia del plan pagado con Stripe, renovar o administrar la tarjeta. */
export function SubscriptionSection() {
  const [renewal, setRenewal] = React.useState<Renewal | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    myRenewal()
      .then((r) => active && setRenewal(r))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!renewal || renewal.source !== "stripe") return null;

  const portal = async () => {
    setBusy(true);
    setError(null);
    try {
      await openBillingPortal("/app/cuenta");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const renewParams = new URLSearchParams({ plan: renewal.plan_id ?? "", periodo: renewal.billing_cycle ?? "monthly" });
  if (renewal.plan_id === "familia" && renewal.seats) renewParams.set("estudiantes", String(renewal.seats));

  return (
    <Section
      icon={CreditCard}
      title="Tu suscripción"
      description={
        renewal.auto_renew
          ? `Se renueva sola el ${dateFmt.format(new Date(renewal.expires_at))}.`
          : `Tu acceso ilimitado está vigente hasta el ${dateFmt.format(new Date(renewal.expires_at))}.`
      }
    >
      {renewal.payment_method && (
        <p className="text-sm text-muted-foreground">Último pago: {METHOD_LABEL[renewal.payment_method]}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {renewal.payment_method === "card" && (
          <Button variant="outline" onClick={portal} disabled={busy}>
            {busy && <Loader2 className="animate-spin motion-reduce:animate-none" />}
            {renewal.auto_renew ? "Administrar tarjeta o cancelar renovación" : "Ver mis pagos con tarjeta"}
          </Button>
        )}
        {!renewal.auto_renew && renewal.plan_id && (
          <Button asChild variant="brand">
            <Link href={`/acceso-ilimitado?${renewParams}`}>Renovar</Link>
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </Section>
  );
}
