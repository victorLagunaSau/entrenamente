import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";

import { AppIcon, Logo } from "@/components/layout/logo";
import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";
import { Button } from "@/components/ui/button";

const PALETTE = [
  { name: "Fondo", hex: "#0A1830", className: "bg-background border" },
  { name: "Marino", hex: "#0F2344", className: "bg-card border" },
  { name: "Azul", hex: "#1E6FE6", className: "bg-primary shadow-glow-primary" },
  { name: "Turquesa", hex: "#12C2A9", className: "bg-secondary shadow-glow-secondary" },
  { name: "Degradado", hex: "Turquesa → Azul", className: "bg-brand-gradient" },
  { name: "Azul texto", hex: "#4C9AFF", className: "bg-brand-light" },
  { name: "Lema / Muted", hex: "#A9BCD0", className: "bg-muted-foreground" },
  { name: "Gris Frío", hex: "#E2E8F0", className: "bg-cool" },
  { name: "Energía", hex: "#FF5E1A", className: "bg-energy shadow-glow-energy" },
  { name: "Oro", hex: "#FFD166", className: "bg-gold" },
];

const VERSIONS = [
  { audience: "estudiante", label: "Versión Estudiante", pitch: "Practica para tu examen de ingreso: IPN, UNAM y más." },
  { audience: "maestro", label: "Versión Maestro", pitch: "Prepara a tus alumnos para su examen de ingreso." },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--devbar-h))] flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20">
          <Logo className="h-9 sm:h-11" priority />
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
        <Logo variant="full" className="mx-auto h-20 sm:h-28" />
        <WorkspacePlaceholder
          icon={Rocket}
          route="/"
          title="Espacio de Trabajo: Landing Page B2C"
          description="Hero, propuesta de valor, planes y testimonios vivirán aquí."
          className="min-h-[340px]"
        />

        <section aria-labelledby="versions" className="flex flex-col gap-4">
          <h2 id="versions" className="text-sm font-semibold text-muted-foreground">
            Versiones de marca
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {VERSIONS.map((v) => (
              <li key={v.audience} className="flex items-center gap-4 rounded-2xl bg-brand-gradient p-4 sm:p-5">
                <AppIcon audience={v.audience} className="size-16 shrink-0 shadow-lg ring-2 ring-white/20" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold tracking-[0.16em] text-white/80 uppercase">
                    {v.label}
                  </span>
                  <span className="mt-1 block font-display text-lg font-semibold text-white text-balance">
                    {v.pitch}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="palette" className="flex flex-col gap-4">
          <h2 id="palette" className="text-sm font-semibold text-muted-foreground">
            Paleta del sistema
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {PALETTE.map((c) => (
              <li key={c.name} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <span className={`size-10 shrink-0 rounded-lg ${c.className}`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{c.hex}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
