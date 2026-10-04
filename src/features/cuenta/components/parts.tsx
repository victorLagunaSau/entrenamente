"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, CircleCheck } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Bloque con título de Perfil/Configuración. */
export function Section({
  icon: Icon,
  title,
  description,
  tone = "default",
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6",
        tone === "danger" && "border-destructive/40"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            tone === "danger" ? "bg-destructive/15 text-destructive" : "bg-secondary/15 text-secondary"
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground text-pretty">{hint}</p>}
    </div>
  );
}

/** Mismo look que Input para los <select> nativos (funcionan bien en celular). */
export const selectClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error)
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
        <CircleAlert className="size-4 shrink-0" /> {error}
      </p>
    );
  if (success)
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-secondary">
        <CircleCheck className="size-4 shrink-0" /> {success}
      </p>
    );
  return null;
}

/** Interruptor accesible (role="switch"). */
export function Toggle({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="text-xs text-muted-foreground text-pretty">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
          checked ? "bg-secondary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
            checked && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}
