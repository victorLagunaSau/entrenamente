"use client";

import * as React from "react";

import { identidadCss } from "../lib/css";
import { getIdentidades } from "../services/identidad-service";
import type { Identidad } from "../types";

type Ctx = {
  identidades: Identidad[];
  /** Ya llegó la respuesta de Supabase (antes puede haber datos del caché local). */
  ready: boolean;
  /** Por id (unam) o por clave (UNAM / unam). */
  find: (key: string | null | undefined) => Identidad | undefined;
  /** Vuelve a leer de Supabase (p. ej. después de editar en el admin). */
  refresh: () => Promise<void>;
};

const IdentidadContext = React.createContext<Ctx>({
  identidades: [],
  ready: false,
  find: () => undefined,
  refresh: async () => {},
});

const CACHE_KEY = "em.identidad.v1";

function readCache(): Identidad[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Identidad[]) : [];
  } catch {
    return [];
  }
}

/**
 * Theme engine de instituciones: carga la identidad de Supabase (con caché local para que la app
 * abra pintada aun sin red) e inyecta las variables --uni-<key>* que usan badges, íconos y el examen.
 */
export function IdentidadProvider({ children }: { children: React.ReactNode }) {
  const [identidades, setIdentidades] = React.useState<Identidad[]>([]);
  const [ready, setReady] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const list = await getIdentidades();
      setIdentidades(list);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(list));
      } catch {
        // Sin almacenamiento local: solo se pierde el arranque rápido.
      }
    } catch {
      // Sin red o sin la migración: se queda con el caché.
    } finally {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    setIdentidades(readCache());
    refresh();
  }, [refresh]);

  const value = React.useMemo<Ctx>(() => {
    const byKey = new Map<string, Identidad>();
    for (const i of identidades) {
      byKey.set(i.id, i);
      byKey.set(i.clave.toLowerCase(), i);
    }
    return { identidades, ready, find: (key) => (key ? byKey.get(key.toLowerCase()) : undefined), refresh };
  }, [identidades, ready, refresh]);

  const css = React.useMemo(() => identidadCss(identidades), [identidades]);

  return (
    <IdentidadContext.Provider value={value}>
      {css && <style id="identidad-instituciones">{css}</style>}
      {children}
    </IdentidadContext.Provider>
  );
}

export const useIdentidades = () => React.useContext(IdentidadContext);

/** Identidad de una institución por id o clave. */
export function useIdentidad(key: string | null | undefined) {
  return React.useContext(IdentidadContext).find(key);
}
