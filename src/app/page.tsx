import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";
import { Button } from "@/components/ui/button";

const PALETTE = [
  { name: "Navy (fondo)", hex: "#0A1B33", className: "bg-background border" },
  { name: "Azul Marca", hex: "#1D70E6", className: "bg-primary shadow-glow-primary" },
  { name: "Teal Marca", hex: "#13BEAD", className: "bg-secondary shadow-glow-secondary" },
  { name: "Degradado", hex: "Teal → Azul", className: "bg-brand-gradient" },
  { name: "Azul texto", hex: "#4C9AFF", className: "bg-brand-light" },
  { name: "Energía", hex: "#FF5E1A", className: "bg-energy shadow-glow-energy" },
  { name: "Oro", hex: "#FFD166", className: "bg-gold" },
  { name: "Gris Frío", hex: "#E2E8F0", className: "bg-cool" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--devbar-h))] flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo tagline />
          <Button asChild size="sm" className="sm:h-10 sm:px-4">
            <Link href="/auth">
              Iniciar / Registrarse <ArrowRight />
            </Link>
          </Button>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-12 md:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-brand-gradient opacity-20 blur-3xl"
        />
        <WorkspacePlaceholder
          icon={Rocket}
          route="/"
          title="Espacio de Trabajo: Landing Page B2C"
          description="Hero, propuesta de valor, planes y testimonios vivirán aquí."
          className="min-h-[380px]"
        />

        <section aria-labelledby="palette" className="flex flex-col gap-4">
          <h2 id="palette" className="text-sm font-semibold text-muted-foreground">
            Paleta del sistema
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PALETTE.map((c) => (
              <li key={c.hex} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <span className={`size-10 shrink-0 rounded-lg ${c.className}`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.hex}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
