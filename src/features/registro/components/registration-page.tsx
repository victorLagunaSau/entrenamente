"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { homePathForCurrentUser } from "@/features/auth/services/auth-service";
import { supabase } from "@/lib/supabase/client";

import type { Flow } from "../types";
import { RegistrationWizard } from "./registration-wizard";

/** `?perfil=` en español para enlaces públicos (landing, campañas). */
const PERFILES: Record<string, Exclude<Flow, "invited">> = { estudiante: "student", tutor: "parent" };

/** Lee los parámetros en cliente: la ruta también se exporta estática para Capacitor. */
export function RegistrationPage() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteCode = params.get("invite_code");
  const initialFlow = PERFILES[params.get("perfil") ?? ""] ?? null;
  const [checking, setChecking] = React.useState(true);

  // Con sesión abierta el registro no hace falta: se va directo a su panel.
  // Se revisa solo al entrar; al crear la cuenta dentro del wizard la sesión nace y no debe sacarlo del paso final.
  React.useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) router.replace(await homePathForCurrentUser());
      else setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="grid flex-1 place-items-center" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
      </div>
    );
  }

  return <RegistrationWizard inviteCode={inviteCode} initialFlow={initialFlow} />;
}
