import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/** Encabezado + espacio de trabajo reservado de un módulo del backoffice. */
export function AdminModule({
  icon: Icon,
  eyebrow,
  title,
  description,
  highlight,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  /** Card destacada con borde dorado (módulos prioritarios). */
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader eyebrow={eyebrow} title={title} />

      <section
        className={cn(
          "flex min-h-[50dvh] flex-col items-center justify-center gap-4 rounded-2xl border p-8 text-center",
          highlight ? "border-gold/40 bg-gold/5 shadow-[0_0_40px_-12px_rgb(255_209_102/0.35)]" : "bg-card"
        )}
      >
        <span
          className={cn(
            "grid size-14 place-items-center rounded-2xl",
            highlight ? "bg-gold/15 text-gold" : "bg-primary/15 text-brand-light"
          )}
        >
          <Icon className="size-7" />
        </span>
        <p className="max-w-lg text-sm text-muted-foreground text-pretty md:text-base">{description}</p>
        {children}
      </section>
    </div>
  );
}

/** Regreso al home de admin + ruta del módulo + título. */
export function AdminPageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <header className="flex flex-col gap-1">
      <Link
        href="/admin"
        className="mb-3 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Inicio
      </Link>
      <code className="font-mono text-xs tracking-wider text-gold">{eyebrow}</code>
      <h1 className="text-2xl font-bold text-balance md:text-3xl">{title}</h1>
      {description && <p className="max-w-2xl text-sm text-muted-foreground text-pretty">{description}</p>}
    </header>
  );
}
