"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

import { homePathForCurrentUser } from "../services/auth-service";

/** Solo rutas internas: evita redirecciones abiertas con ?next=https://… */
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : null);

/**
 * Destino de Google OAuth y de los enlaces de correo (confirmación y recuperación).
 * El cliente canjea el `?code=` al iniciar; aquí solo se espera la sesión y se redirige.
 */
export function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = React.useState<string | null>(params.get("error_description"));

  React.useEffect(() => {
    if (error) return;
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        setError("El enlace ya se usó o expiró. Inicia sesión de nuevo.");
        return;
      }
      router.replace(safeNext(params.get("next")) ?? (await homePathForCurrentUser()));
    });
    return () => {
      cancelled = true;
    };
  }, [error, params, router]);

  if (error) {
    return (
      <div className="flex w-full flex-col gap-4 text-center sm:max-w-md sm:rounded-2xl sm:border sm:bg-card sm:p-8">
        <h1 className="text-xl font-bold">No pudimos iniciar tu sesión</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button asChild size="lg">
          <Link href="/auth">Volver a iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-brand-light motion-reduce:animate-none" /> Entrando…
    </p>
  );
}
