"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Compass } from "lucide-react";

import { pedirGuia, useGuiaVista } from "@/features/guia";
import { MenuItem } from "@/features/modes/components/account-menu";

import { STUDENT_HOMES, type StudentTier } from "../services/access-service";
import { getAvanceGuia } from "../services/guia-service";

/**
 * ¿Le falta algo de su guía de uso? Pro: plan, examen libre y racha. Demo: ver la guía y presentar su primer
 * examen gratis. `null` mientras se consulta (sin punto rojo).
 */
export function useGuiaPendiente(tier: StudentTier, userId: string): boolean | null {
  const [pendiente, setPendiente] = React.useState<boolean | null>(null);
  const { vista: tourVisto } = useGuiaVista("demo", userId);

  React.useEffect(() => {
    let active = true;
    getAvanceGuia(userId)
      .then((a) => {
        if (!active) return;
        setPendiente(tier === "pro" ? !(a.plan && a.libre && a.racha) : !a.libre);
      })
      .catch(() => active && setPendiente(null));
    return () => {
      active = false;
    };
  }, [tier, userId]);

  if (pendiente === null) return null;
  return tier === "demo" ? pendiente || tourVisto === false : pendiente;
}

/** "Guía de uso" del menú de cuenta: abre la guía en el home (desde cualquier pantalla). */
export function GuiaMenuItem({ tier, pendiente }: { tier: StudentTier; pendiente: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const home = STUDENT_HOMES[tier];
  return (
    <MenuItem
      icon={Compass}
      label="Guía de uso"
      dot={pendiente}
      onClick={() => {
        pedirGuia();
        if (pathname !== home) router.push(home);
      }}
    />
  );
}
