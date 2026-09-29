"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/services/auth-service";
import { cn } from "@/lib/utils";

import { MODES } from "../modes";
import { AccountMenu } from "./account-menu";
import { HomeFooter } from "./home-footer";
import { useMode } from "./mode-guard";

/**
 * Estructura de todos los homes: sin barra lateral. `footer` = menú inferior fijo (solo celular y tablet);
 * `topNav` = sus accesos en la barra superior (computadora). `accountExtra` = opciones extra del menú de cuenta.
 * `home` = destino de "Inicio" y del logo cuando el modo tiene más de un home (Pro/Demo del estudiante).
 */
export function PanelShell({
  children,
  footer,
  topNav,
  accountExtra,
  home: homeOverride,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  topNav?: React.ReactNode;
  accountExtra?: React.ReactNode;
  home?: string;
}) {
  const { viewer, mode } = useMode();
  const router = useRouter();
  const pathname = usePathname();
  const [leaving, setLeaving] = React.useState(false);
  const { audience } = MODES[mode];
  const home = homeOverride ?? MODES[mode].home;

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
              <Link href={home} onClick={() => pathname === home && window.scrollTo({ top: 0, behavior: "smooth" })}>
                <House /> Inicio
              </Link>
            </Button>
            {topNav}
            <AccountMenu alias={viewer.alias} email={viewer.email} onLogout={logout} leaving={leaving} extra={accountExtra} />
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-8",
          footer ? "pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8" : "pb-[max(2rem,env(safe-area-inset-bottom))]"
        )}
      >
        {children}
        <HomeFooter audience={audience} home={home} />
      </main>
      {footer}
    </div>
  );
}
