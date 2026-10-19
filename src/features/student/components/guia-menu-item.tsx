"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Compass } from "lucide-react";

import { pedirGuia, useGuiaVista } from "@/features/guia";
import { MenuItem } from "@/features/modes/components/account-menu";

import { STUDENT_HOMES, type StudentTier } from "../services/access-service";
import { getAvanceGuia } from "../services/guia-service";

export type EstadoGuia = {
  /** Le falta algo de la guía: punto en «Guía de uso» hasta completarla. */
  pendiente: boolean;
  /** Además aún no la ha visto: punto en el avatar para que la encuentre. */
  avisar: boolean;
};

/**
 * Avance de la guía de uso. Pendiente = Pro: plan, examen libre y racha; Demo: ver la guía y presentar su primer
 * examen gratis. Vista = cerró el recorrido (Demo), ocultó el checklist (Pro) o la abrió desde el menú.
 * Mientras se consulta, sin puntos.
 */
export function useEstadoGuia(tier: StudentTier, userId: string): EstadoGuia {
  const [faltan, setFaltan] = React.useState<boolean | null>(null);
  const { vista: tourVisto } = useGuiaVista("demo", userId);
  const { vista: proOculta } = useGuiaVista("pro", userId);
  const { vista: abiertaMenu } = useGuiaVista("menu", userId);

  React.useEffect(() => {
    let active = true;
    getAvanceGuia(userId)
      .then((a) => active && setFaltan(tier === "pro" ? !(a.plan && a.libre && a.racha) : !a.libre))
      .catch(() => active && setFaltan(null));
    return () => {
      active = false;
    };
  }, [tier, userId]);

  if (faltan === null || tourVisto === null) return { pendiente: false, avisar: false };
  const vista = abiertaMenu === true || (tier === "demo" ? tourVisto : proOculta === true);
  const pendiente = faltan || (tier === "demo" && !tourVisto);
  return { pendiente, avisar: pendiente && !vista };
}

/** "Guía de uso" del menú de cuenta: abre la guía en el home (desde cualquier pantalla). */
export function GuiaMenuItem({ tier, userId, pendiente }: { tier: StudentTier; userId: string; pendiente: boolean }) {
  const router = useRouter();
  const { marcarVista } = useGuiaVista("menu", userId);
  const pathname = usePathname();
  const home = STUDENT_HOMES[tier];
  return (
    <MenuItem
      icon={Compass}
      label="Guía de uso"
      dot={pendiente}
      onClick={() => {
        marcarVista();
        pedirGuia();
        if (pathname !== home) router.push(home);
      }}
    />
  );
}
