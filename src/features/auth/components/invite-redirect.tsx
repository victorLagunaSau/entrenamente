"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * El alta vive en /registro. Aquí se reenvían los enlaces que apuntan a /auth:
 * - ?invite_code=… (invitación de un padre/tutor)
 * - ?mode=register[&plan=estudiante|padres] (enlaces anteriores de la landing)
 */
export function InviteRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("invite_code");
  const mode = params.get("mode");
  const plan = params.get("plan");

  useEffect(() => {
    if (code) {
      router.replace(`/registro?invite_code=${encodeURIComponent(code)}`);
    } else if (mode === "register") {
      const perfil = plan === "estudiante" ? "estudiante" : plan === "padres" ? "tutor" : null;
      router.replace(perfil ? `/registro?perfil=${perfil}` : "/registro");
    }
  }, [code, mode, plan, router]);

  return null;
}
