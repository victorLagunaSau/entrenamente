"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * /auth ya no tiene pantalla propia: reenvía los enlaces antiguos a su módulo.
 * - ?invite=… / ?invite_code=… (invitación de un padre, tutor o maestro) y ?mode=register → /registro
 * - ?mode=recover → /login/recuperar · ?mode=update → /login/nueva-contrasena
 * - cualquier otro (incluye ?next=) → /login
 */
export function LegacyAuthRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("invite") ?? params.get("invite_code");
    const mode = params.get("mode");
    const plan = params.get("plan");
    const next = params.get("next");

    if (code) {
      router.replace(`/registro?invite_code=${encodeURIComponent(code)}`);
    } else if (mode === "register") {
      const perfil = plan === "estudiante" ? "estudiante" : plan === "padres" ? "tutor" : null;
      router.replace(perfil ? `/registro?perfil=${perfil}` : "/registro");
    } else if (mode === "recover") {
      router.replace("/login/recuperar");
    } else if (mode === "update") {
      router.replace("/login/nueva-contrasena");
    } else {
      router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    }
  }, [params, router]);

  return null;
}
