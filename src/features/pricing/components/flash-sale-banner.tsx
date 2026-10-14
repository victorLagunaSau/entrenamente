"use client";

import * as React from "react";
import { Clock, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

import { formatMxn, INTERVAL_LABEL, regularPriceOf, type FlashSale, type PricingCatalog } from "../lib/pricing";

function timeLeft(iso: string, now: number) {
  const ms = Math.max(new Date(iso).getTime() - now, 0);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d} d ${h} h` : `${h} h ${m} min`;
}

/**
 * Oferta temporal sobre los planes. No cambia la variante A/B del usuario: cuando vence desaparece sola y
 * quedan los precios de su variante. Por porcentaje: solo anuncia (los precios en oferta van en las tarjetas).
 * De precio fijo: trae su propio botón de compra.
 */
export function FlashSaleBanner({
  catalog,
  sale,
  onChoose,
}: {
  catalog: PricingCatalog;
  sale: FlashSale;
  onChoose: (sale: FlashSale) => void;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (new Date(sale.expires_at).getTime() <= now) return null;
  const left = `Termina en ${timeLeft(sale.expires_at, now)}`;
  const until = new Date(sale.expires_at).toLocaleDateString("es-MX", { day: "numeric", month: "long" });

  if (sale.discount_pct) {
    const plan = sale.plan_id ? catalog.plans.find((p) => p.id === sale.plan_id) : null;
    return (
      <aside
        aria-label={`Oferta: ${sale.title}`}
        className="rounded-3xl bg-[linear-gradient(135deg,var(--energy),var(--gold)_45%,var(--secondary))] p-px shadow-glow-energy"
      >
        <div className="relative flex items-center gap-4 overflow-hidden rounded-[calc(1.5rem-1px)] bg-card p-5 sm:gap-6 sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-energy/15 blur-3xl" />
          <span className="relative font-display text-4xl font-extrabold text-energy tabular-nums sm:text-5xl">
            −{Math.round(sale.discount_pct)}%
          </span>
          <div className="relative min-w-0 flex-1">
            <p className="text-xs font-bold tracking-widest text-energy uppercase">Oferta por tiempo limitado</p>
            <p className="text-lg font-bold text-balance">
              {Math.round(sale.discount_pct)} % de descuento en {plan ? `el ${plan.name}` : "todos los planes"} hasta el {until}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-cool">
              <Clock className="size-3.5" aria-hidden /> {left} · ya aplicado en los precios de abajo
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const plan = catalog.plans.find((p) => p.id === sale.plan_id);
  const regular = regularPriceOf(catalog, sale);
  const price = sale.discounted_price ?? 0;
  const per = INTERVAL_LABEL[sale.billing_cycle].per;

  return (
    <aside
      aria-label={`Oferta: ${sale.title}`}
      className="rounded-3xl bg-[linear-gradient(135deg,var(--energy),var(--gold)_45%,var(--secondary))] p-px shadow-glow-energy"
    >
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-[calc(1.5rem-1px)] bg-card p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-energy/15 blur-3xl" />
        <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-energy/15 text-energy">
          <Zap className="size-6 fill-current" aria-hidden />
        </span>
        <div className="relative min-w-0 flex-1">
          <p className="text-xs font-bold tracking-widest text-energy uppercase">{sale.title}</p>
          <p className="text-lg font-bold text-balance">
            {plan?.name ?? "Plan"} por solo{" "}
            <span className="font-display text-2xl tabular-nums">{formatMxn(price)}</span>
            <span className="text-sm font-medium text-muted-foreground"> / {per}</span>
            {regular && regular > price && (
              <span className="ml-2 text-sm font-medium text-muted-foreground line-through tabular-nums">{formatMxn(regular)}</span>
            )}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-cool">
            <Clock className="size-3.5" aria-hidden /> {left}
            {sale.duration_days && ` · ${sale.duration_days} días de acceso`}
          </p>
        </div>
        <Button variant="energy" size="lg" className="relative h-12 shrink-0" onClick={() => onChoose(sale)}>
          Aprovechar oferta
        </Button>
      </div>
    </aside>
  );
}
