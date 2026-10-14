import Fuse from "fuse.js";

import type { Identidad } from "@/features/identidad";

import type { CarreraCatalogo, CatalogoData } from "../types";

/** Mínimo de letras para buscar ("Arq", "Der", "Psi"). */
export const BUSQUEDA_MIN = 3;
/** Pausa después de la última tecla antes de mostrar resultados. */
export const BUSQUEDA_PAUSA_MS = 2000;

/** Sin acentos ni mayúsculas: "Computación" = "computacion". */
export const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Una combinación Carrera → Universidad. */
export type OpcionCarrera = {
  carrera: CarreraCatalogo;
  institucion: Identidad;
  area: string | null;
  /** La institución está en Próximamente: se ve, pero no se puede elegir. */
  bloqueada: boolean;
};

export type IndiceCarreras = {
  opciones: OpcionCarrera[];
  /** Nombre normalizado por id de carrera (coincidencia exacta). */
  nombres: Map<string, string>;
  /** Búsqueda aproximada palabra por palabra. */
  fuse: Fuse<{ id: string; palabras: string[] }>;
  /** sigla, clave o id normalizados → id de institución (para "derecho unam"). */
  instituciones: Map<string, string>;
};

export function crearIndice(catalogo: CatalogoData, identidades: Identidad[]): IndiceCarreras {
  const inst = new Map(identidades.filter((i) => i.activo || i.proximamente).map((i) => [i.id, i]));
  const areas = new Map(catalogo.areas.map((a) => [a.id, a.nombre]));
  const opciones: OpcionCarrera[] = catalogo.carreras.flatMap((c) => {
    const institucion = inst.get(c.institucionId);
    if (!institucion) return [];
    const area = c.areaId ? (areas.get(c.areaId) ?? null) : null;
    return [{ carrera: c, institucion, area, bloqueada: !institucion.activo }];
  });

  const instituciones = new Map<string, string>();
  for (const i of inst.values()) for (const k of [i.id, i.clave, i.sigla]) instituciones.set(normal(k), i.id);

  const nombres = new Map(opciones.map((o) => [o.carrera.id, normal(o.carrera.nombre)]));
  // Tolerancia a errores de dedo ("arquitecctda", "derecha"): se compara contra cada palabra del nombre,
  // así "Licenciatura en Arquitectura" pesa igual que "Arquitectura".
  const fuse = new Fuse(
    [...nombres].map(([id, n]) => ({ id, palabras: n.split(/[^a-z0-9]+/).filter((p) => p.length > 2) })),
    { keys: ["palabras"], threshold: 0.4, ignoreLocation: true, includeScore: true },
  );
  return { opciones, nombres, fuse, instituciones };
}

// Las de instituciones en Próximamente van al final.
const porOrden = (a: OpcionCarrera, b: OpcionCarrera) =>
  Number(a.bloqueada) - Number(b.bloqueada) ||
  a.institucion.orden - b.institucion.orden ||
  a.carrera.orden - b.carrera.orden;

/**
 * "derecho" → todas las Derecho; "derecho unam" o "unam derecho" → solo las de la UNAM; "unam" → toda la UNAM.
 * Si hay coincidencias exactas (sin acentos) se muestran solo esas; si no, las aproximadas más parecidas.
 */
export function buscarCarreras(indice: IndiceCarreras, consulta: string): OpcionCarrera[] {
  const palabras = normal(consulta).split(/\s+/).filter(Boolean);
  const filtroInst = new Set<string>();
  const resto: string[] = [];
  for (const p of palabras) {
    const id = indice.instituciones.get(p);
    if (id) filtroInst.add(id);
    else resto.push(p);
  }
  const candidatas = indice.opciones.filter((o) => filtroInst.size === 0 || filtroInst.has(o.institucion.id));
  if (resto.length === 0) return candidatas.sort(porOrden);

  const exactas = candidatas.filter((o) => resto.every((p) => indice.nombres.get(o.carrera.id)!.includes(p)));
  if (exactas.length) return exactas.sort(porOrden);

  // Cada palabra debe parecerse a alguna palabra del nombre; se suma qué tan lejos quedó cada una.
  const buscables = resto.filter((p) => p.length >= 3);
  if (buscables.length === 0) return [];
  const porPalabra = buscables.map(
    (p) => new Map(indice.fuse.search(p).map((r): [string, number] => [r.item.id, r.score ?? 1])),
  );
  const ranking = candidatas
    .filter((o) => porPalabra.every((m) => m.has(o.carrera.id)))
    .map((o) => ({ o, s: porPalabra.reduce((t, m) => t + m.get(o.carrera.id)!, 0) }))
    .sort((a, b) => Number(a.o.bloqueada) - Number(b.o.bloqueada) || a.s - b.s || porOrden(a.o, b.o));
  if (ranking.length === 0) return [];
  // Solo las cercanas a la mejor: "sicologia" trae Psicología, no todo lo que termina en "-logía".
  const tope = ranking[0].s + 0.15 * buscables.length;
  return ranking.filter((r) => r.s <= tope).map((r) => r.o);
}
