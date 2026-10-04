import type { Area, Carrera, Institucion, TipoInstitucion } from "../types";

export const TIPOS: { value: TipoInstitucion; nombre: string }[] = [
  { value: "universidad", nombre: "Universidad" },
  { value: "examen_especial", nombre: "Examen especial" },
];

export const tipoNombre = (tipo: TipoInstitucion) => TIPOS.find((t) => t.value === tipo)?.nombre ?? tipo;

/** "Carrera" o "Edición" según el tipo de institución. */
export const carreraLabel = (tipo: TipoInstitucion) => (tipo === "examen_especial" ? "Edición" : "Carrera");

export function slugify(text: string, max = 48) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** Id estable a partir de un texto, con sufijo -2, -3… si ya existe. */
export function uniqueId(base: string, taken: Set<string>) {
  const slug = base || "item";
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

export const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export const byOrden = <T extends { orden: number; nombre: string }>(a: T, b: T) =>
  a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es");

/** Carreras agrupadas por área (en el orden de las áreas); las sin área al final. */
export function carrerasPorArea(inst: Institucion): { area: Area | null; carreras: Carrera[] }[] {
  const groups = [...inst.areas].sort(byOrden).map((area) => ({
    area: area as Area | null,
    carreras: inst.carreras.filter((c) => c.areaId === area.id).sort(byOrden),
  }));
  const sinArea = inst.carreras.filter((c) => !c.areaId).sort(byOrden);
  if (sinArea.length) groups.push({ area: null, carreras: sinArea });
  return groups;
}

/** "carreras" o "ediciones" según el tipo de institución. */
export const carrerasLabel = (tipo: TipoInstitucion) => (tipo === "examen_especial" ? "ediciones" : "carreras");
