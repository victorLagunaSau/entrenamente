import Image from "next/image";
import Link from "next/link";

import { BRAND, LOGOS, type Audience } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Imagotipo oficial (variante para fondo oscuro).
 * - compact: símbolo + nombre, para navbars.
 * - full: incluye el lema.
 * - vertical: símbolo arriba, para pantallas de acceso.
 * El tamaño se controla con la altura vía className (p. ej. "h-9").
 */
export function Logo({
  audience = "estudiante",
  variant = "compact",
  href = "/",
  className,
  priority,
}: {
  audience?: Audience;
  variant?: "compact" | "full" | "vertical";
  href?: string;
  className?: string;
  priority?: boolean;
}) {
  const logo = LOGOS[audience][variant];

  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label={BRAND.name}>
      <Image
        src={logo.src}
        width={logo.w}
        height={logo.h}
        alt={BRAND.name}
        priority={priority}
        unoptimized
        className={cn("h-9 w-auto", className)}
      />
    </Link>
  );
}

/** Solo el símbolo en formato de ícono de app (fondo degradado). */
export function AppIcon({ audience, className }: { audience: Audience; className?: string }) {
  const icon = LOGOS[audience].app;
  return (
    <Image
      src={icon.src}
      width={icon.w}
      height={icon.h}
      alt=""
      unoptimized
      className={cn("size-10 rounded-[22%]", className)}
    />
  );
}
