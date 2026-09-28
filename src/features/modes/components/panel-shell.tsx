"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/services/auth-service";

import { MODES } from "../modes";
import { AccountMenu } from "./account-menu";
import { useMode } from "./mode-guard";

/** Estructura de todos los homes: sin barra lateral. `footer` = menú inferior fijo (p. ej. el del estudiante). */
export function PanelShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const { viewer, mode } = useMode();
  const router = useRouter();
  const pathname = usePathname();
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
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link
                href={home}
                onClick={() => pathname === home && window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <House /> Inicio
              </Link>
            </Button>
            <AccountMenu alias={viewer.alias} email={viewer.email} onLogout={logout} leaving={leaving} />
          </div>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8"
        style={{
          paddingBottom: footer ? "calc(6rem + env(safe-area-inset-bottom))" : "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>
      {footer}
    </div>
  );
}
