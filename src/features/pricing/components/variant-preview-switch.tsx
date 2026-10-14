"use client";

import { cn } from "@/lib/utils";

import type { PricingState } from "../hooks/use-pricing";
import { VARIANT_LABEL, type Variant } from "../lib/pricing";

/**
 * Solo administradores: alterna entre las variantes A y B del experimento para revisar ambas ofertas.
 * Es una vista previa: no cambia la variante asignada ni cuenta en la analítica.
 */
export function VariantPreviewSwitch({ pricing }: { pricing: PricingState }) {
  if (!pricing.isAdmin || !pricing.variant) return null;
  return (
    <div
      role="radiogroup"
      aria-label="Pruebas: variante de precios"
      className="mx-auto flex w-fit items-center gap-2 rounded-full border border-dashed border-gold/50 bg-gold/5 py-1 pr-1 pl-3 text-xs print:hidden"
    >
      <span className="font-semibold text-gold">Pruebas · A/B</span>
      <span className="flex rounded-full bg-muted p-0.5">
        {(Object.keys(VARIANT_LABEL) as Variant[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={pricing.variant === v}
            onClick={() => pricing.setPreview(v)}
            className={cn(
              "rounded-full px-2.5 py-1 font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              pricing.variant === v ? "bg-secondary text-secondary-foreground" : "text-cool hover:text-foreground"
            )}
          >
            {VARIANT_LABEL[v]}
          </button>
        ))}
      </span>
    </div>
  );
}
