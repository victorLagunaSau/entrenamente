"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/services/auth-service";

import { MODES } from "../modes";
import { useMode } from "./mode-guard";

/** Estructura de todos los homes: sin barra lateral ni barra inferior; las herramientas viven en el home. */
export function PanelShell({ children }: { children: React.ReactNode }) {
  const { viewer, mode } = useMode();
  const router = useRouter();
  const [leaving, setLeaving] = React.useState(false);
  const { audience, home } = MODES[mode];

  const logout = async () => {
    setLeaving(true);
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 md:px-8">
          <Logo audience={audience} href={home} className="h-8" />
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 max-w-56 text-right sm:block">
              <p className="truncate text-sm font-semibold">{viewer.alias}</p>
              <p className="truncate text-xs text-muted-foreground">{viewer.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout} disabled={leaving} aria-label="Cerrar sesión">
              <LogOut /> <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>
    </div>
  );
}
