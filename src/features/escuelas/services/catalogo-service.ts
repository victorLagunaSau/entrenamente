/**
 * Catálogo de instituciones › áreas › carreras en Supabase.
 *
 * Lectura: `getCatalogo()` sirve para el registro, el landing y el importador de preguntas.
 * RLS ya oculta lo inactivo a estudiantes y visitantes; el admin recibe todo y decide con
 * `incluirInactivos`. Escritura: solo admin (RLS con `is_admin()`); nada se borra, se desactiva.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import { IDENTIDAD_COLUMNS, toIdentidad } from "@/features/identidad/services/identidad-service";
import { supabase } from "@/lib/supabase/client";

import { byOrden, normalizeName, slugify, uniqueId } from "../lib/catalogo";
import type { Area, AreaInput, Carrera, CarreraInput, Institucion, InstitucionInput } from "../types";

type InstitucionRow = Parameters<typeof toIdentidad>[0];
type AreaRow = { id: string; institucion_id: string; codigo: string; nombre: string; activo: boolean; orden: number };
type CarreraRow = { id: string; institucion_id: string; area_id: string | null; nombre: string; activo: boolean; orden: number };

const toArea = (r: AreaRow): Area => ({
  id: r.id,
  institucionId: r.institucion_id,
  codigo: r.codigo,
  nombre: r.nombre,
  activo: r.activo,
  orden: r.orden,
});

const toCarrera = (r: CarreraRow): Carrera => ({
  id: r.id,
  institucionId: r.institucion_id,
  areaId: r.area_id,
  nombre: r.nombre,
  activo: r.activo,
  orden: r.orden,
});

/** Error con mensaje listo para mostrar en la UI. */
export class CatalogoError extends Error {}

const DUPLICATE_MESSAGES: [string, string][] = [
  ["instituciones_clave_key", "Ya existe una institución con esa clave."],
  ["areas_institucion_id_codigo_key", "Ya existe un área con ese código en esta institución."],
  ["carreras_nombre_unico", "Ya existe una carrera con ese nombre en esa área."],
];

function fail(error: PostgrestError): never {
  if (error.code === "23505") {
    const hit = DUPLICATE_MESSAGES.find(([constraint]) => error.message.includes(constraint));
    throw new CatalogoError(hit?.[1] ?? "Ya existe un registro con esos datos.");
  }
  if (error.code === "23503") throw new CatalogoError("El área elegida no pertenece a esta institución.");
  if (error.code === "42501") throw new CatalogoError("No tienes permiso para modificar el catálogo.");
  if (error.code === "23514") throw new CatalogoError("Algún dato no tiene el formato esperado.");
  throw new CatalogoError(error.message);
}

/** Instituciones con sus áreas y carreras, ordenadas. */
export async function getCatalogo({ incluirInactivos = false } = {}): Promise<Institucion[]> {
  const [inst, areas, carreras] = await Promise.all([
    supabase.from("instituciones").select(IDENTIDAD_COLUMNS),
    supabase.from("areas").select("id, institucion_id, codigo, nombre, activo, orden"),
    supabase.from("carreras").select("id, institucion_id, area_id, nombre, activo, orden"),
  ]);
  if (inst.error) fail(inst.error);
  if (areas.error) fail(areas.error);
  if (carreras.error) fail(carreras.error);

  const keep = <T extends { activo: boolean }>(x: T) => incluirInactivos || x.activo;

  return (inst.data as InstitucionRow[])
    .filter(keep)
    .map((r) => ({
      ...toIdentidad(r),
      areas: (areas.data as AreaRow[]).filter((a) => a.institucion_id === r.id && keep(a)).map(toArea).sort(byOrden),
      carreras: (carreras.data as CarreraRow[])
        .filter((c) => c.institucion_id === r.id && keep(c))
        .map(toCarrera)
        .sort(byOrden),
    }))
    .sort(byOrden);
}

/* ─────────────────────────── Escritura (admin) ─────────────────────────── */

const nextOrden = (items: { orden: number }[], step = 1) => Math.max(0, ...items.map((i) => i.orden)) + step;

/** Limpia y valida lo capturado; lanza CatalogoError con el primer problema. */
function cleanInstitucion(input: InstitucionInput, catalogo: Institucion[], selfId?: string): InstitucionInput {
  const clave = input.clave.trim().toUpperCase();
  const nombre = input.nombre.trim().replace(/\s+/g, " ");
  if (!/^[A-Z0-9]{2,12}$/.test(clave)) throw new CatalogoError("La clave lleva de 2 a 12 letras o números, sin espacios.");
  if (!nombre) throw new CatalogoError("Escribe el nombre.");
  if (catalogo.some((i) => i.id !== selfId && i.clave === clave)) throw new CatalogoError("Ya existe una institución con esa clave.");
  return { clave, nombre, tipo: input.tipo, examen: input.examen?.trim() || null };
}

export async function crearInstitucion(input: InstitucionInput, catalogo: Institucion[]) {
  const v = cleanInstitucion(input, catalogo);
  const id = uniqueId(slugify(v.clave), new Set(catalogo.map((i) => i.id)));
  const { error } = await supabase.from("instituciones").insert({
    id,
    clave: v.clave,
    nombre: v.nombre,
    tipo: v.tipo,
    examen: v.examen,
    sigla: v.clave,
    orden: nextOrden(catalogo, 10),
  });
  if (error) fail(error);
  return id;
}

export async function actualizarInstitucion(id: string, input: InstitucionInput, catalogo: Institucion[]) {
  const v = cleanInstitucion(input, catalogo, id);
  const { error } = await supabase
    .from("instituciones")
    .update({ clave: v.clave, nombre: v.nombre, tipo: v.tipo, examen: v.examen })
    .eq("id", id);
  if (error) fail(error);
}

export async function setInstitucionActiva(id: string, activo: boolean) {
  const { error } = await supabase.from("instituciones").update({ activo }).eq("id", id);
  if (error) fail(error);
}

function cleanArea(input: AreaInput, inst: Institucion, selfId?: string): AreaInput {
  const codigo = input.codigo.trim().toUpperCase();
  const nombre = input.nombre.trim().replace(/\s+/g, " ");
  if (!/^[A-Z0-9]{1,12}$/.test(codigo)) throw new CatalogoError("El código lleva de 1 a 12 letras o números, sin espacios (ej. A1).");
  if (!nombre) throw new CatalogoError("Escribe el nombre del área.");
  if (inst.areas.some((a) => a.id !== selfId && a.codigo === codigo))
    throw new CatalogoError("Ya existe un área con ese código en esta institución.");
  return { codigo, nombre };
}

export async function crearArea(inst: Institucion, input: AreaInput, catalogo: Institucion[]) {
  const v = cleanArea(input, inst);
  const taken = new Set(catalogo.flatMap((i) => i.areas.map((a) => a.id)));
  const id = uniqueId(`${inst.id}-${slugify(v.codigo)}`, taken);
  const { error } = await supabase
    .from("areas")
    .insert({ id, institucion_id: inst.id, codigo: v.codigo, nombre: v.nombre, orden: nextOrden(inst.areas) });
  if (error) fail(error);
}

export async function actualizarArea(inst: Institucion, id: string, input: AreaInput) {
  const v = cleanArea(input, inst, id);
  const { error } = await supabase.from("areas").update(v).eq("id", id);
  if (error) fail(error);
}

export async function setAreaActiva(id: string, activo: boolean) {
  const { error } = await supabase.from("areas").update({ activo }).eq("id", id);
  if (error) fail(error);
}

/** Intercambia el orden de dos áreas (flechas subir/bajar). */
export async function intercambiarOrdenAreas(a: Area, b: Area) {
  // Si comparten orden, se desempatan para que el cambio se note.
  const [oa, ob] = a.orden === b.orden ? [b.orden + 1, a.orden] : [b.orden, a.orden];
  const [ra, rb] = await Promise.all([
    supabase.from("areas").update({ orden: oa }).eq("id", a.id),
    supabase.from("areas").update({ orden: ob }).eq("id", b.id),
  ]);
  if (ra.error) fail(ra.error);
  if (rb.error) fail(rb.error);
}

function cleanCarrera(input: CarreraInput, inst: Institucion, selfId?: string): CarreraInput {
  const nombre = input.nombre.trim().replace(/\s+/g, " ");
  if (!nombre) throw new CatalogoError("Escribe el nombre.");
  // El mismo nombre puede repetirse en otra área (ej. IPN Ingeniería Ambiental en A1 y A2): cada una tiene su guía.
  const areaId = input.areaId || null;
  if (inst.carreras.some((c) => c.id !== selfId && c.areaId === areaId && normalizeName(c.nombre) === normalizeName(nombre)))
    throw new CatalogoError("Ya existe una carrera con ese nombre en esa área.");
  if (input.areaId && !inst.areas.some((a) => a.id === input.areaId))
    throw new CatalogoError("El área elegida no pertenece a esta institución.");
  return { nombre, areaId };
}

export async function crearCarrera(inst: Institucion, input: CarreraInput, catalogo: Institucion[]) {
  const v = cleanCarrera(input, inst);
  const taken = new Set(catalogo.flatMap((i) => i.carreras.map((c) => c.id)));
  let base = `${inst.id}-${slugify(v.nombre, 40)}`;
  // Misma carrera en otra área: el id lleva el código del área (ipn-ingenieria-ambiental-a2).
  const area = inst.areas.find((a) => a.id === v.areaId);
  if (taken.has(base) && area) base = `${base}-${slugify(area.codigo)}`;
  const id = uniqueId(base, taken);
  const { error } = await supabase
    .from("carreras")
    .insert({ id, institucion_id: inst.id, area_id: v.areaId, nombre: v.nombre, orden: nextOrden(inst.carreras) });
  if (error) fail(error);
}

export async function actualizarCarrera(inst: Institucion, id: string, input: CarreraInput) {
  const v = cleanCarrera(input, inst, id);
  const { error } = await supabase.from("carreras").update({ nombre: v.nombre, area_id: v.areaId }).eq("id", id);
  if (error) fail(error);
}

export async function setCarreraActiva(id: string, activo: boolean) {
  const { error } = await supabase.from("carreras").update({ activo }).eq("id", id);
  if (error) fail(error);
}
