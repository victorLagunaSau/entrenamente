"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleAlert, Loader2, ShieldX } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";

import { canViewMode, homePathFor, MODES, type Mode, ownMode } from "../modes";
import { getViewer, type Viewer } from "../services/viewer-service";

type ModeValue = { viewer: Viewer; mode: Mode; /** Vuelve a leer el perfil (p. ej. tras cambiar nombre o foto). */ refreshViewer: () => void };

const ModeContext = React.createContext<ModeValue | null>(null);

/** Quién está en sesión y qué modo (home) está viendo; solo dentro de <ModeGuard>. */
export function useMode() {
  const ctx = React.useContext(ModeContext);
  if (!ctx) throw new Error("useMode debe usarse dentro de <ModeGuard>");
  return ctx;
}

/**
 * Protección en el cliente de cada home (sin middleware por el export estático de Capacitor).
 * Sin sesión → login; rol sin acceso a este modo → 403. La seguridad real de los datos la da RLS.
 * Sin `mode` (pantallas de cuenta) se usa el modo propio del rol.
 */
export function ModeGuard({ mode: requested, children }: { mode?: Mode; children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [viewer, setViewer] = React.useState<Viewer | null | "error" | undefined>(undefined);
  const userId = session?.user.id;

  React.useEffect(() => {
    if (session === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [session, pathname, router]);

  const [version, setVersion] = React.useState(0);
  const refreshViewer = React.useCallback(() => setVersion((v) => v + 1), []);

  // Otro usuario: se vuelve a verificar desde cero (refrescar al mismo usuario no parpadea).
  React.useEffect(() => setViewer(undefined), [userId]);

  React.useEffect(() => {
    if (!userId) return;
    let active = true;
    getViewer()
      .then((result) => active && setViewer(result))
      .catch(() => active && setViewer("error"));
    return () => {
      active = false;
    };
  }, [userId, version]);

  const value = React.useMemo(
    () =>
      viewer && viewer !== "error"
        ? { viewer, mode: requested ?? ownMode(viewer.userType), refreshViewer }
        : null,
    [viewer, requested, refreshViewer]
  );

  if (!session || viewer === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="Verificando acceso">
        <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
      </div>
    );
  }
  if (viewer === "error" || !value) return <AccessError />;
  if (!canViewMode(value.viewer.userType, value.mode))
    return <Forbidden mode={value.mode} home={homePathFor(value.viewer.userType)} />;

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

function Forbidden({ mode, home }: { mode: Mode; home: string }) {
  return (
    <GuardScreen>
      <span className="grid size-14 place-items-center rounded-2xl bg-destructive/15 text-destructive">
        <ShieldX className="size-7" />
      </span>
      <code className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 font-mono text-xs text-destructive">
        403 · Acceso denegado
      </code>
      <h1 className="text-2xl font-bold text-balance">Esta sección es solo para el modo {MODES[mode].label}</h1>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Tu cuenta no tiene acceso a este panel. Si crees que es un error, contacta al equipo de Entrena Mente.
      </p>
      <Button asChild variant="brand">
        <Link href={home}>Ir a mi panel</Link>
      </Button>
    </GuardScreen>
  );
}

function AccessError() {
  return (
    <GuardScreen>
      <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
        <CircleAlert className="size-4 shrink-0" /> No pudimos verificar tus permisos. Recarga la página.
      </p>
    </GuardScreen>
  );
}

function GuardScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <section className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center">
        <Logo audience="maestro" className="mb-2 h-8" />
        {children}
      </section>
    </main>
  );
}
