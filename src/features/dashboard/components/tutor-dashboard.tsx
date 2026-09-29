"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CircleAlert, CreditCard, Loader2, TriangleAlert, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { ModeSwitcher } from "@/features/modes/components/mode-switcher";
import { PanelShell } from "@/features/modes/components/panel-shell";
import { cn } from "@/lib/utils";

import { TUTOR_COPY } from "../lib/tutor-plans";
import { TutorProvider, useTutor } from "./tutor-context";

export const TUTOR_TABS = [
  { href: "/app/dashboard", label: "Estudiantes", icon: Users },
  { href: "/app/dashboard/analytics", label: "Estadísticas", icon: BarChart3 },
  { href: "/app/dashboard/billing", label: "Suscripción", icon: CreditCard },
] as const;

/**
 * Home de padres, tutores y maestros: 100 % gestión y analítica (este rol no presenta exámenes).
 * Las tres pestañas son rutas propias y comparten los datos del panel.
 */
export function TutorDashboard({ children }: { children: React.ReactNode }) {
  return (
    <ModeGuard mode="parent">
      <PanelShell>
        <TutorProvider>
          <div className="flex flex-col gap-6">
            <ModeSwitcher />
            <TutorHeader />
            <TutorTabs />
            <TutorBody>{children}</TutorBody>
          </div>
        </TutorProvider>
      </PanelShell>
    </ModeGuard>
  );
}

function TutorHeader() {
  const { kind } = useTutor();
  const copy = TUTOR_COPY[kind];
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-balance sm:text-3xl">{copy.title}</h1>
        <p className="text-sm text-muted-foreground text-pretty">{copy.subtitle}</p>
      </div>
      <PaidSwitch />
    </header>
  );
}

/** TEMPORAL (prototipo): alterna la vista entre cuenta sin plan y cuenta pagada. Solo cambia lo que se ve. */
function PaidSwitch() {
  const { simulatedPaid, setSimulatedPaid } = useTutor();
  return (
    <label className="flex w-fit shrink-0 cursor-pointer items-center gap-3 rounded-full border border-dashed border-gold/50 bg-gold/5 py-1.5 pr-1.5 pl-3 text-xs text-cool print:hidden">
      <span className="flex flex-col leading-tight">
        <span className="font-semibold text-gold">Prototipo</span>
        <span>Simular cuenta pagada</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={simulatedPaid}
        onClick={() => setSimulatedPaid(!simulatedPaid)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          simulatedPaid ? "bg-secondary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
            simulatedPaid && "translate-x-5"
          )}
        />
      </button>
    </label>
  );
}

function TutorTabs() {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  return (
    <nav aria-label="Secciones del panel" className="print:hidden">
      <ul className="inline-flex h-11 w-full items-center rounded-lg bg-muted p-1 text-muted-foreground sm:w-auto">
        {TUTOR_TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="h-full flex-1 sm:flex-none">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-full w-full items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-all outline-none sm:px-4",
                  "hover:text-cool focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active && "bg-background text-brand-light shadow-sm"
                )}
              >
                <tab.icon className="size-4 max-[380px]:hidden" aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TutorBody({ children }: { children: React.ReactNode }) {
  const { panel, error, reload } = useTutor();

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
        <p className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" /> No pudimos cargar tu panel.
        </p>
        <Button variant="outline" size="sm" onClick={reload}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!panel) {
    return (
      <div className="grid min-h-60 place-items-center" role="status" aria-label="Cargando panel">
        <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
      </div>
    );
  }
  return children;
}

/** Muro de suscripción vencida: bloquea Estudiantes y Estadísticas; Suscripción sigue abierta. */
export function InactiveWall() {
  return (
    <section
      role="alert"
      className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-6 py-10 text-center"
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-destructive/15 text-destructive">
        <TriangleAlert className="size-7" aria-hidden />
      </span>
      <h2 className="text-xl font-bold text-balance">Tu suscripción no se encuentra activa</h2>
      <p className="max-w-lg text-sm text-cool text-pretty">
        Tus estudiantes han pasado a modo inactivo. Renueva o amplía tu plan para restaurar su acceso ilimitado a las
        evaluaciones.
      </p>
      <Button asChild variant="brand" size="lg">
        <Link href="/app/dashboard/billing">Renovar o ampliar mi plan</Link>
      </Button>
    </section>
  );
}
