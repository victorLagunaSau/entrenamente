"use client";

import type { LucideIcon } from "lucide-react";
import { CalendarClock, CalendarRange, Check, CreditCard, Rocket, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  discounted,
  formatMxn,
  INTERVAL_LABEL,
  INTERVAL_MONTHS,
  percentSaleFor,
  type BillingInterval,
  type FlashSale,
  type Offer,
} from "../lib/pricing";

const ICONS: Record<BillingInterval, LucideIcon> = {
  monthly: CreditCard,
  quarterly: CalendarClock,
  annual: CalendarRange,
  one_time: CreditCard,
};

const TAGLINES: Record<BillingInterval, string> = {
  monthly: "Entrena sin límites, mes a mes",
  quarterly: "Tres meses de práctica enfocada",
  annual: "Todo tu ciclo de admisión, en un solo pago",
  one_time: "Un solo pago",
};

/** Mensual equivalente, redondeado hacia abajo a centavos ($699/año → $58.25). */
const monthlyOf = (price: number, interval: BillingInterval) => Math.floor((price * 100) / INTERVAL_MONTHS[interval]) / 100;

/**
 * Tarjetas del Plan Estudiante según la variante del usuario. La de mayor ahorro va destacada con su badge
 * ("Ahorras 31 %"). Con una oferta por porcentaje vigente, el precio en oferta va grande y el normal tachado.
 * `compact` (modal): apiladas y sin la lista de beneficios.
 */
export function StudentOfferCards({
  offers,
  compact = false,
  sales = [],
  onChoose,
}: {
  offers: Offer[];
  compact?: boolean;
  sales?: FlashSale[];
  onChoose: (offer: Offer, sale: FlashSale | null) => void;
}) {
  const best = offers.reduce<Offer | null>((b, o) => (o.savingsPct > (b?.savingsPct ?? 0) ? o : b), null);
  const shortest = offers.reduce<Offer | null>(
    (b, o) => (!b || INTERVAL_MONTHS[o.interval] < INTERVAL_MONTHS[b.interval] ? o : b),
    null
  );

  return (
    <div className={cn("grid gap-5", !compact && offers.length > 1 && "lg:grid-cols-2 lg:items-stretch")}>
      {offers.map((o) => {
        const featured = o === best;
        const label = INTERVAL_LABEL[o.interval];
        const Icon = ICONS[o.interval];
        const sale = percentSaleFor(sales, o.plan.id);
        const pay = sale?.discount_pct ? discounted(o.price, sale.discount_pct) : o.price;
        const features =
          o === shortest
            ? o.plan.features
            : [
                `Todo lo del plan ${INTERVAL_LABEL[shortest!.interval].name}, sin pagos recurrentes cada ${INTERVAL_LABEL[shortest!.interval].per}`,
                `${INTERVAL_MONTHS[o.interval]} meses de práctica sin restricciones`,
                ...(o.savingsPct > 0 ? [`Ahorras ${o.savingsPct} % frente al plan ${INTERVAL_LABEL[shortest!.interval].name}`] : []),
              ];
        return (
          <article
            key={`${o.plan.id}-${o.interval}`}
            className={cn("relative rounded-3xl p-px", featured ? "bg-gradient-to-b from-energy via-energy/40 to-border" : "bg-border")}
          >
            {o.savingsPct > 0 && (
              <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-energy px-3 py-1 text-xs font-bold whitespace-nowrap text-background shadow-glow-energy">
                Ahorras {o.savingsPct}%
              </span>
            )}
            <div className={cn("flex h-full flex-col rounded-[calc(1.5rem-1px)] bg-card", compact ? "gap-3 p-5" : "gap-5 p-6 sm:p-8")}>
              {!compact && (
                <span
                  className={cn(
                    "grid size-12 place-items-center rounded-2xl",
                    featured ? "bg-energy/15 text-energy" : "bg-brand-gradient text-white shadow-glow-secondary"
                  )}
                >
                  <Icon className="size-6" aria-hidden />
                </span>
              )}
              <div>
                <h3 className={cn("font-display font-bold", compact ? "text-xl" : "text-3xl")}>{label.name}</h3>
                <p className="text-cool">{TAGLINES[o.interval]}</p>
              </div>
              <div>
                {sale?.discount_pct && (
                  <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-energy/15 px-2.5 py-0.5 text-xs font-bold text-energy">
                    <Zap className="size-3 fill-current" aria-hidden /> {Math.round(sale.discount_pct)} % de descuento
                  </p>
                )}
                <p className={cn("font-display font-extrabold tabular-nums", compact ? "text-4xl" : "text-5xl")}>
                  {formatMxn(pay)}
                  <span className="text-base font-medium text-muted-foreground"> MXN / {label.per}</span>
                </p>
                {pay !== o.price && (
                  <p className="text-sm text-muted-foreground">
                    Precio normal <span className="line-through tabular-nums">{formatMxn(o.price)}</span>
                  </p>
                )}
                <p className="mt-1 text-sm text-muted-foreground text-pretty">
                  {o.interval === "monthly"
                    ? "Pago mensual."
                    : `Equivale a ${formatMxn(monthlyOf(pay, o.interval))} MXN al mes. ${label.adverb}.`}
                </p>
              </div>
              <Button size="lg" variant={featured ? "energy" : "brand"} className="h-12 w-full" onClick={() => onChoose(o, sale)}>
                <Rocket /> Pagar ahora
              </Button>
              {!compact && (
                <div className="flex flex-col gap-3 border-t pt-5">
                  <p className="text-sm font-semibold">{o === shortest ? "Incluye:" : "Todo lo anterior, más:"}</p>
                  <ul className="flex flex-col gap-2.5">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-cool">
                        <Check className={cn("mt-0.5 size-4 shrink-0", featured ? "text-energy" : "text-secondary")} aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
