"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useSession } from "../hooks/use-session";

/**
 * Protección en el cliente para las vistas autenticadas (también sirve en el export
 * estático de Capacitor). La seguridad real de los datos la dan las políticas RLS.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (session === null) router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
  }, [session, pathname, router]);

  if (!session) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
      </div>
    );
  }
  return children;
}
