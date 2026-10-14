"use client";

/**
 * Grados escolares desde Supabase (`grados_para`): código universal (g00–g12, s01–s06, pu) con el nombre
 * que usa cada país. Nada de nombres en el código: se editan en la base (admin).
 */

import * as React from "react";

import { supabase } from "@/lib/supabase/client";

export type Grado = {
  /** g00–g12, s01–s06 (semestres de bachillerato) o pu (preuniversitario). */
  codigo: string;
  tipo: "grado" | "semestre" | "preuniversitario";
  /** 0–12: lo que usan las reglas (pu = 12). */
  gradoNumero: number;
  semestre: number | null;
  /** Para agrupar: "Primaria", "Bachillerato", "High School"… */
  nivel: string;
  nombre: string;
  nombreCorto: string | null;
  pais: string;
};

/** En esta etapa (solo exámenes de admisión) todos los estudiantes empiezan como preuniversitarios (grado 12). */
export const GRADO_ADMISION = "pu";

type Row = {
  codigo: string;
  tipo: Grado["tipo"];
  grado_numero: number;
  semestre: number | null;
  nivel: string;
  nombre: string;
  nombre_corto: string | null;
  pais: string;
};

// Una lectura por país y sesión.
const cache = new Map<string, Promise<Grado[]>>();

/** `pais` null → el país del usuario o, si no tiene, México. */
export function getGrados(pais: string | null = null): Promise<Grado[]> {
  const key = pais ?? "";
  let p = cache.get(key);
  if (!p) {
    p = Promise.resolve(supabase.rpc("grados_para", { p_pais: pais })).then(({ data, error }) => {
      if (error) throw error;
      return (data as Row[]).map((r) => ({
        codigo: r.codigo,
        tipo: r.tipo,
        gradoNumero: r.grado_numero,
        semestre: r.semestre,
        nivel: r.nivel,
        nombre: r.nombre,
        nombreCorto: r.nombre_corto,
        pais: r.pais,
      }));
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export function useGrados(pais: string | null = null) {
  const [grados, setGrados] = React.useState<Grado[] | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    let vivo = true;
    getGrados(pais)
      .then((g) => vivo && setGrados(g))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [pais]);
  return { grados, error };
}

/** Agrupa por nivel conservando el orden escolar (para <optgroup>). */
export function porNivel(grados: Grado[]) {
  const grupos: { nivel: string; grados: Grado[] }[] = [];
  for (const g of grados) {
    const last = grupos.at(-1);
    if (last?.nivel === g.nivel) last.grados.push(g);
    else grupos.push({ nivel: g.nivel, grados: [g] });
  }
  return grupos;
}
