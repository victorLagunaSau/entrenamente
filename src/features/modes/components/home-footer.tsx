import { Logo } from "@/components/layout/logo";
import type { Audience } from "@/lib/brand";

/** Pie de todos los homes: por ahora solo el logo, centrado y apenas más claro que el fondo. */
export function HomeFooter({ audience, home }: { audience: Audience; home: string }) {
  return (
    <footer className="mt-auto flex justify-center pt-16 pb-2">
      <Logo audience={audience} href={home} className="h-7 opacity-15 brightness-0 invert transition-opacity hover:opacity-30" />
    </footer>
  );
}
