"use client";

import * as React from "react";
import { BarChart3, CircleAlert, FlaskConical, ReceiptText, Tag } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { AdminPageHeader } from "../admin-module";
import { CatalogTab } from "./catalog-tab";
import { FunnelTab } from "./funnel-tab";
import { ReceiptsTab } from "./receipts-tab";

/**
 * Localhost paga en la sandbox de Stripe y producción en la cuenta real, sobre la misma base de datos. Por defecto
 * todo el panel cuenta solo lo real; "Incluir pruebas" suma los pagos de la sandbox y los recibos marcados como prueba.
 */
const IncludeTestsContext = React.createContext(false);
export const useIncludeTests = () => React.useContext(IncludeTestsContext);

/** Panel ejecutivo de ingresos: embudo y A/B, monitor de recibos, gestor de planes y ofertas flash. */
export function RevenueWorkspace() {
  const [includeTests, setIncludeTests] = React.useState(false);
  return (
    <IncludeTestsContext.Provider value={includeTests}>
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="/admin/revenue-analytics"
        title="Ingresos y A/B testing"
        description="Embudo de conversión por variante, recibos con su vigencia y los precios que ve cada rol."
      />
      <Tabs defaultValue="funnel">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="h-auto flex-wrap sm:w-fit">
          <TabsTrigger value="funnel" className="gap-1.5 px-3 py-2">
            <BarChart3 className="size-4" aria-hidden /> Funnel y A/B
          </TabsTrigger>
          <TabsTrigger value="receipts" className="gap-1.5 px-3 py-2">
            <ReceiptText className="size-4" aria-hidden /> Recibos
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1.5 px-3 py-2">
            <Tag className="size-4" aria-hidden /> Planes y ofertas
          </TabsTrigger>
        </TabsList>
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
              includeTests ? "border-energy/50 bg-energy/10 text-energy" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-energy)]"
              checked={includeTests}
              onChange={(e) => setIncludeTests(e.target.checked)}
            />
            <FlaskConical className="size-4" aria-hidden /> Incluir pruebas
          </label>
        </div>
        <TabsContent value="funnel">
          <FunnelTab />
        </TabsContent>
        <TabsContent value="receipts">
          <ReceiptsTab />
        </TabsContent>
        <TabsContent value="catalog">
          <CatalogTab />
        </TabsContent>
      </Tabs>
    </div>
    </IncludeTestsContext.Provider>
  );
}

export function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <CircleAlert className="size-4 shrink-0" /> {text}
    </p>
  );
}

export const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
