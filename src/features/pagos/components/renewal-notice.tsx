"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";

import { myRenewal, type Renewal } from "../services/pagos-service";

/** Días antes del vencimiento en que aparece el aviso. */
const NOTICE_DAYS = 7;

const renewHref = (r: Renewal) => {
  const q = new URLSearchParams({ plan: r.plan_id ?? "", periodo: r.billing_cycle ?? "monthly" });
  if (r.plan_id === "familia" && r.seats) q.set("estudiantes", String(r.seats));
  return `/acceso-ilimitado?${q}`;
};

/**
 * Aviso "tu acceso vence en N días" para quien pagó con OXXO o SPEI (o una oferta de pago único):
 * esos pagos no se renuevan solos. Con tarjeta no aparece, porque Stripe cobra la renovación.
 */
export function RenewalNotice() {
  const [renewal, setRenewal] = React.useState<Renewal | null>(null);

  React.useEffect(() => {
    let active = true;
    myRenewal()
      .then((r) => active && setRenewal(r))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!renewal || renewal.auto_renew || renewal.source !== "stripe" || !renewal.plan_id) return null;
  if (renewal.days_left > NOTICE_DAYS) return null;

  const when =
    renewal.days_left <= 0 ? "hoy" : renewal.days_left === 1 ? "mañana" : `en ${renewal.days_left} días`;
  return (
    <aside
      aria-label="Renovación"
      className="flex flex-col gap-3 rounded-2xl border border-energy/40 bg-energy/10 p-4 sm:flex-row sm:items-center"
    >
      <CalendarClock className="size-6 shrink-0 text-energy" aria-hidden />
      <p className="flex-1 text-sm">
        <strong>Tu acceso ilimitado vence {when}</strong>{" "}
        <span className="text-cool">
          ({new Date(renewal.expires_at).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}). Renueva con
          tarjeta, OXXO o SPEI para no perder tu ritmo.
        </span>
      </p>
      <Button asChild variant="energy">
        <Link href={renewHref(renewal)}>Renovar</Link>
      </Button>
    </aside>
  );
}
