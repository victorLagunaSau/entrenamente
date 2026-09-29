"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";

import { useMode } from "@/features/modes/components/mode-guard";

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
