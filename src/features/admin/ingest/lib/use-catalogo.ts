"use client";

import * as React from "react";

import { getCatalogo } from "@/features/escuelas/services/catalogo-service";
import type { Institucion } from "@/features/escuelas/types";

// Una sola lectura por sesión: el catálogo cambia poco y lo usan todas las pestañas.
let cache: Promise<Institucion[]> | null = null;

/** Catálogo activo de instituciones › áreas › carreras (Supabase). */
export function useCatalogo() {
  const [catalogo, setCatalogo] = React.useState<Institucion[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback((force = false) => {
    if (force) cache = null;
    setError(null);
    (cache ??= getCatalogo()).then(setCatalogo).catch((e: unknown) => {
      cache = null;
      setError(e instanceof Error ? e.message : "No se pudo cargar el catálogo de escuelas.");
    });
  }, []);

  React.useEffect(() => load(), [load]);

  return { catalogo, error, reload: () => load(true) };
}
