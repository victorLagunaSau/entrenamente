import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Encabezado de paso. Recibe el foco al cambiar de paso (lo hace WizardShell)
 * para que los lectores de pantalla anuncien el nuevo contenido.
 */
export function StepHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-1.5", className)}>
      <h1 data-step-heading tabIndex={-1} className="text-2xl font-bold text-balance outline-none sm:text-[1.7rem]">
        {title}
      </h1>
      {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
    </header>
  );
}
