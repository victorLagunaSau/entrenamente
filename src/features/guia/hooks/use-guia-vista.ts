"use client";

import * as React from "react";

const PREFIX = "em.guia.v1";

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    // Sin almacenamiento local (modo privado): se trata como no vista.
    return false;
  }
}

/**
 * ¿Ya vio este usuario la guía `guia`? Se recuerda por usuario en este navegador. `null` mientras no se sabe
 * (primer render), para no abrir la guía antes de tiempo.
 */
export function useGuiaVista(guia: string, userId: string | null | undefined) {
  const key = userId ? `${PREFIX}.${guia}.${userId}` : null;
  const [vista, setVista] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setVista(key ? read(key) : null);
  }, [key]);

  const marcarVista = React.useCallback(() => {
    setVista(true);
    if (!key) return;
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Igual que arriba: la guía volverá a salir en la próxima visita.
    }
  }, [key]);

  return { vista, marcarVista };
}
