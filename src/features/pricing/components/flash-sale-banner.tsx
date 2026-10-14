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
 * Oferta temporal sobre los planes. Es una oferta aparte: no cambia la variante A/B del usuario, y cuando
 * vence desaparece sola y queda lo que su variante le muestra.
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

  const plan = catalog.plans.find((p) => p.id === sale.plan_id);
  const regular = regularPriceOf(catalog, sale);
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
            <span className="font-display text-2xl tabular-nums">{formatMxn(sale.discounted_price)}</span>
            <span className="text-sm font-medium text-muted-foreground"> / {per}</span>
            {regular && regular > sale.discounted_price && (
              <span className="ml-2 text-sm font-medium text-muted-foreground line-through tabular-nums">{formatMxn(regular)}</span>
            )}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-cool">
            <Clock className="size-3.5" aria-hidden /> Termina en {timeLeft(sale.expires_at, now)} · {sale.duration_days} días de acceso
          </p>
        </div>
        <Button variant="energy" size="lg" className="relative h-12 shrink-0" onClick={() => onChoose(sale)}>
          Aprovechar oferta
        </Button>
      </div>
    </aside>
  );
}
