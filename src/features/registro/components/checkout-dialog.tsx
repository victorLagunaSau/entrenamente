"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { useRegistration } from "../context/registration-context";
import { formatMxn, PLANS } from "../data/plans";
import * as service from "../services/registration-service";
import type { PlanId } from "../types";

type Status = { kind: "idle" } | { kind: "paying" } | { kind: "paid" } | { kind: "error"; message: string };

/**
 * Modal de pago. Hoy simula Stripe; con el backend, "Pagar" abrirá Stripe Checkout
 * y el regreso (success_url) confirmará la suscripción.
 */
export function CheckoutDialog() {
  const { state, dispatch } = useRegistration();
  const [plan, setPlan] = React.useState<PlanId>("unlimited");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [simulateFailure, setSimulateFailure] = React.useState(false);
  const open = state.checkoutPlan !== null;

  React.useEffect(() => {
    if (state.checkoutPlan) {
      setPlan(state.checkoutPlan);
      setStatus({ kind: "idle" });
    }
  }, [state.checkoutPlan]);

  const options = (Object.values(PLANS) as (typeof PLANS)[PlanId][]).filter((p) => p.audience === PLANS[plan].audience);
  const selected = PLANS[plan];
  const panelHref = state.flow === "parent" ? "/app/dashboard" : "/app/student";

  const pay = async () => {
    setStatus({ kind: "paying" });
    const result = await service.startCheckout(plan, { simulateFailure });
    setStatus(result.ok ? { kind: "paid" } : { kind: "error", message: result.error ?? "No se pudo procesar el pago." });
  };

  const close = (next: boolean) => {
    if (!next && status.kind !== "paying") dispatch({ type: "checkout", plan: null });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent onInteractOutside={(e) => status.kind === "paying" && e.preventDefault()}>
        {status.kind === "paid" ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none">
            <span className="grid size-14 place-items-center rounded-full bg-secondary text-secondary-foreground shadow-glow-secondary">
              <Check className="size-7" strokeWidth={3} />
            </span>
            <DialogHeader className="items-center pr-0">
              <DialogTitle>¡{selected.name} activado!</DialogTitle>
              <DialogDescription>Te enviamos el recibo a {state.account.email || "tu correo"}.</DialogDescription>
            </DialogHeader>
            <Button asChild size="lg" className="w-full">
              <Link href={panelHref}>
                Ir a mi panel <ArrowRight />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Desbloquea el acceso completo</DialogTitle>
              <DialogDescription>Cancela cuando quieras. Sin permanencia.</DialogDescription>
            </DialogHeader>

            <fieldset className="flex flex-col gap-2" disabled={status.kind === "paying"}>
              <legend className="sr-only">Plan</legend>
              {options.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                    plan === p.id ? "border-primary bg-primary/10" : "border-border hover:border-brand-light/50"
                  )}
                >
                  <input type="radio" name="plan" className="sr-only" checked={plan === p.id} onChange={() => setPlan(p.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display font-semibold">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{p.features.join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-lg font-bold">{formatMxn(p.priceMxn)}</span>
                    <span className="block text-xs text-muted-foreground">al {p.period}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {status.kind === "error" && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" /> {status.message}
              </p>
            )}

            <Button size="lg" onClick={pay} disabled={status.kind === "paying"}>
              {status.kind === "paying" ? (
                <>
                  <LoaderCircle className="animate-spin" /> Procesando pago…
                </>
              ) : (
                <>
                  <CreditCard /> Pagar {formatMxn(selected.priceMxn)}/{selected.period}
                </>
              )}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Pago seguro procesado por Stripe
            </p>

            {/* Solo para revisar el flujo con datos simulados. */}
            <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-secondary/30 px-3 py-2 font-mono text-[11px] text-secondary">
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                className="accent-[var(--secondary)]"
              />
              DEV · simular tarjeta rechazada
            </label>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
