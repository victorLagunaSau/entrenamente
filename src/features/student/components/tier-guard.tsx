"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";

import { useMode } from "@/features/modes/components/mode-guard";
import { cn } from "@/lib/utils";

import { getMyAccess, STUDENT_HOMES, tierFor, type StudentTier } from "../services/access-service";

/**
 * Segundo filtro del home del estudiante (va dentro de <ModeGuard mode="student">): sin suscripción
 * activa, /home redirige a /home-demo; con suscripción, /home-demo redirige a /home.
 * El admin ve ambos sin redirección (vista previa). La seguridad real está en el servidor.
 */
export function TierGuard({ tier, children }: { tier: StudentTier; children: React.ReactNode }) {
  const { viewer } = useMode();
  const router = useRouter();
  const isAdmin = viewer.userType === "admin";
  const [state, setState] = React.useState<"checking" | "ok" | "error">(isAdmin ? "ok" : "checking");

  React.useEffect(() => {
    if (isAdmin) return;
    let active = true;
    getMyAccess()
      .then((access) => {
        if (!active) return;
        const allowed = tierFor(access.status);
        if (allowed === tier) setState("ok");
        else router.replace(STUDENT_HOMES[allowed]);
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [isAdmin, tier, router]);

  if (state === "error") {
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" /> No pudimos verificar tu suscripción. Recarga la página.
        </p>
      </main>
    );
  }
  if (state === "checking") {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="Verificando suscripción">
        <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
      </div>
    );
  }
  return children;
}

/** /app/student: resuelve el home que le toca (Pro o Demo) y redirige; el admin entra al Pro. */
export function StudentHomeRedirect() {
  const { viewer } = useMode();
  const router = useRouter();

  React.useEffect(() => {
    if (viewer.userType === "admin") {
      router.replace(STUDENT_HOMES.pro);
      return;
    }
    getMyAccess()
      .then((access) => router.replace(STUDENT_HOMES[tierFor(access.status)]))
      .catch(() => router.replace(STUDENT_HOMES.demo));
  }, [viewer.userType, router]);

  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Abriendo tu home">
      <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
    </div>
  );
}

/** Solo administradores: salta entre los dos homes del estudiante (Demo y Pro) para revisar ambas experiencias. */
export function TierSwitcher({ tier }: { tier: StudentTier }) {
  const { viewer } = useMode();
  if (viewer.userType !== "admin") return null;
  return (
    <nav
      aria-label="Pruebas: home del estudiante"
      className="flex w-fit items-center gap-2 rounded-full border border-dashed border-gold/50 bg-gold/5 py-1 pr-1 pl-3 text-xs print:hidden"
    >
      <span className="font-semibold text-gold">Pruebas</span>
      <span className="flex rounded-full bg-muted p-0.5">
        {(
          [
            ["demo", "Home Demo"],
            ["pro", "Home Pro"],
          ] as const
        ).map(([id, label]) => (
          <Link
            key={id}
            href={STUDENT_HOMES[id]}
            aria-current={tier === id ? "page" : undefined}
            className={cn(
              "rounded-full px-2.5 py-1 font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              tier === id ? "bg-secondary text-secondary-foreground" : "text-cool hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </span>
    </nav>
  );
}
