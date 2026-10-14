/**
 * Catálogo público de carreras: UNA lectura por sesión (RPC catalogo_publico) compartida por toda la app,
 * con copia en el teléfono para que abra al instante y sin red. La identidad de las instituciones viene
 * aparte (features/identidad), también con una sola lectura.
 */

import { cargarIdentidades } from "@/features/identidad/services/identidad-service";
import type { Institucion } from "@/features/escuelas/types";
import { supabase } from "@/lib/supabase/client";

import type { AreaCatalogo, CatalogoData } from "../types";

const CACHE_KEY = "em.catalogo.v1";

type Rpc = {
  areas: { id: string; institucion_id: string; codigo: string; nombre: string; orden: number }[];
  carreras: {
    id: string;
    institucion_id: string;
    area_id: string | null;
    nombre: string;
    orden: number;
    con_reactivos: boolean;
  }[];
};

const toArea = (a: Rpc["areas"][number]): AreaCatalogo => ({
  id: a.id,
  institucionId: a.institucion_id,
  codigo: a.codigo,
  nombre: a.nombre,
  orden: a.orden,
});

async function fetchCatalogo(): Promise<CatalogoData> {
  const { data, error } = await supabase.rpc("catalogo_publico");
  if (!error) {
    const r = data as Rpc;
    return {
      areas: r.areas.map(toArea),
      carreras: r.carreras.map((c) => ({
        id: c.id,
        institucionId: c.institucion_id,
        areaId: c.area_id,
        nombre: c.nombre,
        orden: c.orden,
        conReactivos: c.con_reactivos,
      })),
    };
  }
  // Mientras no se corre 20261013000000_catalogo_publico.sql: tablas directas, sin saber qué tiene reactivos.
  if (error.code !== "PGRST202") throw error;
  const [areas, carreras] = await Promise.all([
    supabase.from("areas").select("id, institucion_id, codigo, nombre, orden").eq("activo", true).order("orden"),
    supabase.from("carreras").select("id, institucion_id, area_id, nombre, orden").eq("activo", true).order("orden"),
  ]);
  if (areas.error) throw areas.error;
  if (carreras.error) throw carreras.error;
  return {
    areas: (areas.data as Rpc["areas"]).map(toArea),
    carreras: (carreras.data as Omit<Rpc["carreras"][number], "con_reactivos">[]).map((c) => ({
      id: c.id,
      institucionId: c.institucion_id,
      areaId: c.area_id,
      nombre: c.nombre,
      orden: c.orden,
      conReactivos: null,
    })),
  };
}

/* ───────────── Store compartido (lo leen los hooks con useSyncExternalStore) ───────────── */

export type CatalogoSnapshot = {
  data: CatalogoData | null;
  /** Ya llegó la respuesta de Supabase (antes puede haber datos del caché local). */
  ready: boolean;
  error: boolean;
};

export const EMPTY_SNAPSHOT: CatalogoSnapshot = { data: null, ready: false, error: false };

let snapshot: CatalogoSnapshot = EMPTY_SNAPSHOT;
let pendiente: Promise<CatalogoData> | null = null;
let cacheLeido = false;
const listeners = new Set<() => void>();

function set(next: Partial<CatalogoSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSnapshot = () => snapshot;

function leerCache() {
  if (cacheLeido) return;
  cacheLeido = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw && !snapshot.data) set({ data: JSON.parse(raw) as CatalogoData });
  } catch {
    // Sin almacenamiento local: solo se pierde el arranque rápido.
  }
}

/** Reutiliza la lectura en curso o ya hecha. `force` vuelve a leer. */
export function cargarCatalogo({ force = false } = {}): Promise<CatalogoData> {
  if (typeof window !== "undefined") leerCache();
  if (force || !pendiente) {
    pendiente = fetchCatalogo().then(
      (data) => {
        set({ data, ready: true, error: false });
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch {
          // Igual que arriba.
        }
        return data;
      },
      (e) => {
        pendiente = null;
        // Sin red: se queda con el caché si lo hay.
        set({ ready: true, error: !snapshot.data });
        if (snapshot.data) return snapshot.data;
        throw e;
      },
    );
  }
  return pendiente;
}

/** El admin cambió el catálogo: la siguiente pantalla que lo pida lo lee de nuevo. */
export function invalidarCatalogo() {
  pendiente = null;
}

/* ───────────── Forma "instituciones › áreas › carreras" (exámenes, metas, admin) ───────────── */

/** Catálogo activo con la identidad de cada institución. Sin consultas extra si ya se leyó. */
export async function getCatalogoActivo(): Promise<Institucion[]> {
  const [identidades, { areas, carreras }] = await Promise.all([cargarIdentidades(), cargarCatalogo()]);
  return identidades
    .filter((i) => i.activo)
    .map((i) => ({
      ...i,
      areas: areas.filter((a) => a.institucionId === i.id).map((a) => ({ ...a, activo: true })),
      carreras: carreras
        .filter((c) => c.institucionId === i.id)
        .map((c) => ({
          id: c.id,
          institucionId: c.institucionId,
          areaId: c.areaId,
          nombre: c.nombre,
          orden: c.orden,
          activo: true,
        })),
    }))
    .sort((a, b) => a.orden - b.orden);
}
