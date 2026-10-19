"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { useSession } from "@/features/auth/hooks/use-session";
import { syncVariantOnce } from "@/features/pricing/services/pricing-service";

import { canViewMode, homePathFor, type Mode, ownMode } from "../modes";
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
 * Sin sesión → login; rol sin acceso a este modo → su propio home. La seguridad real de los datos la da RLS.
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
      .then((result) => {
        if (active) setViewer(result);
        // Variante A/B de por vida: se graba en el perfil la primera vez (p. ej. altas con Google).
        if (result) syncVariantOnce(result.id);
      })
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

  if (!session || viewer === undefined) return <Checking label="Verificando acceso" />;
  if (viewer === "error" || !value) return <AccessError />;
  if (!canViewMode(value.viewer.userType, value.mode)) return <GoHome home={homePathFor(value.viewer.userType)} />;

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

/** Rol sin acceso a este modo: en lugar de un 403, se le lleva directo a su propio home. */
function GoHome({ home }: { home: string }) {
  const router = useRouter();
  React.useEffect(() => {
    router.replace(home);
  }, [home, router]);
  return <Checking label="Abriendo tu panel" />;
}

function Checking({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label={label}>
      <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
    </div>
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
