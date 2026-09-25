"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BarChart3,
  Flame,
  House,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Trophy,
  User,
  Users,
} from "lucide-react";

import { Logo } from "@/components/layout/logo";
import type { Audience } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShellNavItem = { id: string; label: string; icon: LucideIcon };

const SHELLS = {
  student: {
    audience: "estudiante",
    roleLabel: "Estudiante",
    nav: [
      { id: "home", label: "Inicio", icon: House },
      { id: "exams", label: "Exámenes", icon: NotebookPen },
      { id: "streaks", label: "Rachas", icon: Flame },
      { id: "ranking", label: "Logros", icon: Trophy },
      { id: "profile", label: "Perfil", icon: User },
    ],
  },
  dashboard: {
    audience: "maestro",
    roleLabel: "Padres · Tutores · Maestros",
    nav: [
      { id: "overview", label: "Resumen", icon: LayoutDashboard },
      { id: "students", label: "Alumnos", icon: Users },
      { id: "reports", label: "Reportes", icon: BarChart3 },
      { id: "settings", label: "Ajustes", icon: Settings },
    ],
  },
} satisfies Record<string, { audience: Audience; roleLabel: string; nav: ShellNavItem[] }>;

/**
 * Estructura común de las vistas autenticadas:
 * barra lateral en escritorio (md+) y Bottom Nav Bar táctil en móvil.
 */
export function AppShell({
  variant,
  children,
}: {
  variant: keyof typeof SHELLS;
  children: React.ReactNode;
}) {
  const { nav, roleLabel, audience } = SHELLS[variant];
  const [active, setActive] = React.useState(nav[0]?.id);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-card/60 p-4 md:flex">
        <Logo audience={audience} className="h-10" />
        <p className="mt-6 px-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          {roleLabel}
        </p>
        <nav className="mt-2 flex flex-col gap-1">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active === item.id
                  ? "bg-primary/15 text-brand-light"
                  : "text-cool hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur md:px-8">
          <span className="md:hidden">
            <Logo audience={audience} className="h-8" />
          </span>
          <span className="hidden text-sm text-muted-foreground md:block">{roleLabel}</span>
          <Button variant="ghost" size="icon" aria-label="Notificaciones">
            <Bell className="size-5" />
          </Button>
        </header>

        {/* pb extra en móvil para no quedar debajo de la Bottom Nav */}
        <main className="flex-1 p-4 pb-24 md:p-8">{children}</main>
      </div>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 z-40 grid border-t bg-card/95 backdrop-blur md:hidden"
        style={{
          bottom: 0,
          paddingBottom: "env(safe-area-inset-bottom)",
          gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))`,
        }}
      >
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(item.id)}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              active === item.id ? "text-brand-light" : "text-muted-foreground"
            )}
          >
            <item.icon className="size-6" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
