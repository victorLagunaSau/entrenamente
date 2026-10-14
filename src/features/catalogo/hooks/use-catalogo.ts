"use client";

import * as React from "react";

import { useIdentidades } from "@/features/identidad";

import { crearIndice, type OpcionCarrera } from "../lib/buscar";
import { cargarCatalogo, EMPTY_SNAPSHOT, getSnapshot, subscribe } from "../services/catalogo-store";

/** Catálogo público compartido: la primera pantalla que lo pide lo descarga; las demás lo reutilizan. */
export function useCatalogo() {
  const snap = React.useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  React.useEffect(() => {
    cargarCatalogo().catch(() => {});
  }, []);
  return { ...snap, retry: () => cargarCatalogo({ force: true }).catch(() => {}) };
}

/** Índice de búsqueda (Carrera → Universidad), se arma una vez por versión del catálogo. */
export function useIndiceCarreras() {
  const { data, ready, error, retry } = useCatalogo();
  const { identidades } = useIdentidades();
  const indice = React.useMemo(
    () => (data && identidades.length ? crearIndice(data, identidades) : null),
    [data, identidades],
  );
  return { indice, ready, error, retry };
}

/** Carrera + institución por id de carrera (null mientras carga o si ya no está en el catálogo). */
export function useOpcionCarrera(careerId: string | null | undefined): OpcionCarrera | null {
  const { indice } = useIndiceCarreras();
  return React.useMemo(
    () => (careerId && indice ? (indice.opciones.find((o) => o.carrera.id === careerId) ?? null) : null),
    [indice, careerId],
  );
}
