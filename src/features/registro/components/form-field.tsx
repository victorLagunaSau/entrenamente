import * as React from "react";
import { CircleAlert } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Etiqueta + control + ayuda/error en línea. El control recibe los ids de
 * `aria-describedby` y `aria-invalid` vía render prop.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: (a11y: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="flex items-baseline justify-between gap-2">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">Opcional</span>}
      </Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Clases para marcar en rojo un control inválido. */
export const invalidClass = "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/30";
