import { Logo } from "@/components/layout/logo";
import type { Audience } from "@/lib/brand";

/** Pie de todos los homes: por ahora solo el logo a color, centrado. */
export function HomeFooter({ audience, home }: { audience: Audience; home: string }) {
  return (
    <footer className="mt-auto flex justify-center pt-16 pb-2">
      <Logo audience={audience} href={home} className="h-7 opacity-80 transition-opacity hover:opacity-100" />
    </footer>
  );
}
