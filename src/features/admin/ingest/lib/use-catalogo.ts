"use client";

import * as React from "react";

import { getCatalogoActivo } from "@/features/catalogo";
import type { Institucion } from "@/features/escuelas/types";

// Mismo catálogo compartido de toda la app (features/catalogo): sin lecturas repetidas.
let cache: Promise<Institucion[]> | null = null;

/** Catálogo activo de instituciones › áreas › carreras (Supabase). */
export function useCatalogo() {
  const [catalogo, setCatalogo] = React.useState<Institucion[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback((force = false) => {
    if (force) cache = null;
    setError(null);
    (cache ??= getCatalogoActivo()).then(setCatalogo).catch((e: unknown) => {
      cache = null;
      setError(e instanceof Error ? e.message : "No se pudo cargar el catálogo de escuelas.");
    });
  }, []);

  React.useEffect(() => load(), [load]);

  return { catalogo, error, reload: () => load(true) };
}
