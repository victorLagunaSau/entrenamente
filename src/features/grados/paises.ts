/**
 * Países desde Supabase (tabla `paises`). Lectura pública de los activos; el admin los ve todos.
 */

import { supabase } from "@/lib/supabase/client";

export type Pais = {
  /** ISO 3166-1 alfa-2: MX, GT, US. */
  codigo: string;
  nombre: string;
  bandera: string | null;
  activo: boolean;
};

let pendiente: Promise<Pais[]> | null = null;

/** Una lectura por sesión. `force` vuelve a leer. */
export function getPaises({ force = false } = {}): Promise<Pais[]> {
  if (force || !pendiente) {
    pendiente = Promise.resolve(
      supabase.from("paises").select("codigo, nombre, bandera, activo").order("orden"),
    ).then(({ data, error }) => {
      if (error) throw error;
      return data as Pais[];
    });
    pendiente.catch(() => (pendiente = null));
  }
  return pendiente;
}
