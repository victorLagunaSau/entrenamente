import { cn } from "@/lib/utils";

/** Encabezado común de los módulos: etiqueta pequeña + título + subtítulo opcional. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  className,
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-3xl flex-col items-center gap-4 text-center", className)}>
      <span className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
        {eyebrow}
      </span>
      <h2 id={id} className="text-3xl font-bold text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle && <p className="max-w-2xl text-base text-muted-foreground text-pretty sm:text-lg">{subtitle}</p>}
    </div>
  );
}
