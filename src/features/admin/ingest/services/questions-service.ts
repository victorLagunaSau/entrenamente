/**
 * Banco de preguntas en Supabase (tablas `reactivos`, `reactivo_carreras`, `lecturas`, `materias`).
 * El filtrado y la paginación ocurren en la base para no traer miles de filas al cliente;
 * la importación va por bloques a `importar_reactivos()` (cada llamada es una transacción corta).
 */

import type { PostgrestError } from "@supabase/supabase-js";

import type { Dificultad, Ponderacion, Respuesta } from "@/features/exam/types";
import { supabase } from "@/lib/supabase/client";

import { MATERIAS_BASE } from "../lib/catalog";
import { searchMode } from "../lib/search";
import type { Materia, Pregunta, PreguntaDraft, QuestionFilters, SearchResult } from "../types";

/** Error con mensaje listo para mostrar en la UI. */
export class BancoError extends Error {}

function fail(error: PostgrestError): never {
  if (error.code === "42501") throw new BancoError("No tienes permiso para modificar el banco de preguntas.");
  throw new BancoError(error.message);
}

/* ─────────────────────────── Materias ─────────────────────────── */

// Caché del catálogo de materias; empieza con la base y se reemplaza al leer la tabla.
let materias: Materia[] = [...MATERIAS_BASE];

/** Catálogo de materias en memoria (base + lo leído de la tabla `materias`). */
export const getMaterias = () => materias;

export async function loadMaterias(): Promise<Materia[]> {
  const { data, error } = await supabase.from("materias").select("clave, nombre").order("nombre");
  if (error) fail(error);
  materias = data as Materia[];
  return materias;
}

/* ─────────────────────────── Preconsulta de filtros ─────────────────────────── */

/** Conteos de reactivos distintos por opción de filtro (nunca trae preguntas). */
export type Resumen = {
  instituciones: { clave: string; total: number }[];
  areas: { id: string; total: number }[];
  carreras: { id: string; total: number }[];
  materias: { clave: string; total: number }[];
};

/** Cascada Institución → Área → Carrera → Materia: solo opciones que tienen preguntas. */
export async function getResumen(filtro: { institucion?: string | null; area?: string | null; carrera?: string | null } = {}): Promise<Resumen> {
  const { data, error } = await supabase.rpc("resumen_banco", {
    p_institucion: filtro.institucion ?? null,
    p_area: filtro.area ?? null,
    p_carrera: filtro.carrera ?? null,
  });
  if (error) fail(error);
  return data as Resumen;
}

/* ─────────────────────────── Inventario ─────────────────────────── */

/** Conteos de un grupo: `total` incluye variantes; `raices` cuenta cada pregunta raíz una vez. */
export type ConteoBanco = {
  id: string;
  total: number;
  raices: number;
  por_materia: Record<string, number>;
  por_dificultad: Partial<Record<Dificultad, number>>;
};

export type Inventario = {
  instituciones: ConteoBanco[];
  areas: ConteoBanco[];
  carreras: ConteoBanco[];
  sin_carrera: number;
  dosificacion: {
    carrera_id: string;
    por_materia: Record<string, number>;
    metodo: "oficial" | "estimado";
    fuente: string | null;
    total_reactivos_oficial: number | null;
    archivo: string | null;
    actualizado: string;
  }[];
  lotes: {
    id: number;
    archivo: string;
    institucion_id: string | null;
    carreras: string[];
    total: number;
    nuevas: number;
    actualizadas: number;
    sin_cambios: number;
    omitidas: number;
    created_at: string;
  }[];
};

/** Cuántas preguntas hay por escuela, área y carrera (solo conteos) y las últimas cargas. */
export async function getInventario(): Promise<Inventario> {
  const { data, error } = await supabase.rpc("inventario_banco");
  if (error) {
    if (error.code === "PGRST202") throw new BancoError("Falta correr la migración 20261004000000_inventario_banco.sql en Supabase.");
    fail(error);
  }
  return data as Inventario;
}

/* ─────────────────────────── Lectura ─────────────────────────── */

const SELECT =
  "codigo, materia_clave, dificultad, valor_puntos, fuente, fuente_detallada, pregunta, respuestas, solucion, variantes, updated_at, " +
  "institucion:instituciones!inner(clave), lectura:lecturas(texto), destinos:reactivo_carreras(carrera_id)";

type Row = {
  codigo: string;
  materia_clave: string;
  dificultad: Dificultad;
  valor_puntos: number;
  fuente: string;
  fuente_detallada: string;
  pregunta: string;
  respuestas: Respuesta[];
  solucion: string[];
  variantes: string[];
  updated_at: string;
  institucion: { clave: string };
  lectura: { texto: string } | null;
  destinos: { carrera_id: string }[];
};

const toPregunta = (r: Row): Pregunta => ({
  id: r.codigo,
  institucion: r.institucion.clave,
  materia: r.materia_clave,
  fuente: r.fuente,
  fuenteDetallada: r.fuente_detallada,
  valorPuntos: Number(r.valor_puntos),
  dificultad: r.dificultad,
  lecturaAsociada: r.lectura?.texto ?? null,
  pregunta: r.pregunta,
  respuestas: r.respuestas.map((x) => ({ ...x, ponderacion: Number(x.ponderacion) as Ponderacion })),
  solucionPasoAPaso: r.solucion,
  variantesAsociadas: r.variantes,
  destinos: r.destinos.map((d) => d.carrera_id),
  actualizado: r.updated_at,
});

// Caracteres con significado en los filtros de PostgREST.
const sanitize = (s: string) => s.replace(/[,()*%\\]/g, " ").trim();

export async function searchQuestions(
  filters: QuestionFilters,
  { page = 1, pageSize = 10 }: { page?: number; pageSize?: number } = {}
): Promise<SearchResult> {
  // Misma regla que la UI: sin ID, institución + materia son obligatorias (consultas acotadas e indexadas).
  const mode = searchMode(filters);
  if (!mode) throw new BancoError("Búsqueda sin ID: institución y materia son obligatorias.");

  const byCarrera = mode === "filters" && Boolean(filters.carreras?.length);
  let q = supabase
    .from("reactivos")
    .select(byCarrera ? `${SELECT}, filtro:reactivo_carreras!inner(carrera_id)` : SELECT, { count: "exact" });

  if (mode === "id") q = q.eq("codigo", filters.query.trim().toUpperCase());
  else {
    q = q.eq("institucion.clave", filters.institucion!).eq("materia_clave", filters.materia!);
    if (filters.dificultad) q = q.eq("dificultad", filters.dificultad);
    if (byCarrera) q = q.in("filtro.carrera_id", filters.carreras!);
    const tema = sanitize(filters.query);
    if (tema) q = q.or(`pregunta.ilike.*${tema}*,fuente_detallada.ilike.*${tema}*`);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await q.order("codigo").range(from, from + pageSize - 1);
  if (error) fail(error);
  const total = count ?? 0;
  return {
    items: (data as unknown as Row[]).map(toPregunta),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getQuestion(codigo: string): Promise<Pregunta | null> {
  const { data, error } = await supabase.from("reactivos").select(SELECT).eq("codigo", codigo).maybeSingle();
  if (error) fail(error);
  return data ? toPregunta(data as unknown as Row) : null;
}

export async function codigoExiste(codigo: string): Promise<boolean> {
  const { count, error } = await supabase.from("reactivos").select("codigo", { count: "exact", head: true }).eq("codigo", codigo);
  if (error) fail(error);
  return (count ?? 0) > 0;
}

/* ─────────────────────────── Escritura ─────────────────────────── */

/** Huella del contenido (sin carreras ni fecha): la base la compara para no reescribir lo que no cambió. */
export async function hashPregunta(p: PreguntaDraft): Promise<string> {
  const canonical = JSON.stringify([
    p.id,
    p.institucion,
    p.materia,
    p.fuente,
    p.fuenteDetallada,
    p.valorPuntos,
    p.dificultad,
    p.lecturaAsociada,
    p.pregunta,
    p.respuestas.map((r) => [r.id, r.texto, r.ponderacion, r.diagnosticoError]),
    p.solucionPasoAPaso,
    p.variantesAsociadas,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function toPayload(p: PreguntaDraft) {
  return {
    codigo: p.id,
    institucion: p.institucion,
    materia: p.materia,
    materia_nombre: materias.find((m) => m.clave === p.materia)?.nombre ?? p.materia,
    dificultad: p.dificultad,
    valor_puntos: p.valorPuntos,
    fuente: p.fuente,
    fuente_detallada: p.fuenteDetallada,
    lectura: p.lecturaAsociada,
    pregunta: p.pregunta,
    respuestas: p.respuestas,
    solucion: p.solucionPasoAPaso,
    variantes: p.variantesAsociadas,
    hash: await hashPregunta(p),
  };
}

export type ImportPlan = { nuevas: number; actualizadas: number; sinCambios: number };
export type Existente = { hash: string; destinos: string[] };

/** Huella y carreras de los códigos que ya están en el banco (consulta ligera, por bloques). */
export async function getExistentes(codigos: string[]): Promise<Map<string, Existente>> {
  const out = new Map<string, Existente>();
  for (let i = 0; i < codigos.length; i += 100) {
    const { data, error } = await supabase
      .from("reactivos")
      .select("codigo, hash, destinos:reactivo_carreras(carrera_id)")
      .in("codigo", codigos.slice(i, i + 100));
    if (error) fail(error);
    for (const r of data as { codigo: string; hash: string; destinos: { carrera_id: string }[] }[])
      out.set(r.codigo, { hash: r.hash, destinos: r.destinos.map((d) => d.carrera_id) });
  }
  return out;
}

/** Clasifica cada reactivo contra lo que ya hay en el banco, antes de escribir nada. */
export async function planImport(
  drafts: PreguntaDraft[],
  existentes: Map<string, Existente>
): Promise<Map<string, keyof ImportPlan>> {
  const entries = await Promise.all(
    drafts.map(async (d): Promise<[string, keyof ImportPlan]> => {
      const prev = existentes.get(d.id);
      if (!prev) return [d.id, "nuevas"];
      const same = prev.hash === (await hashPregunta(d)) && d.destinos.every((c) => prev.destinos.includes(c));
      return [d.id, same ? "sinCambios" : "actualizadas"];
    })
  );
  return new Map(entries);
}

type RpcResult = { nuevas: number; actualizadas: number; sin_cambios: number };

/** Un bloque del importador: las carreras se suman a las que ya tenía cada reactivo. */
export async function importChunk(drafts: PreguntaDraft[]): Promise<ImportPlan> {
  const items = await Promise.all(drafts.map(toPayload));
  const { data, error } = await supabase.rpc("importar_reactivos", { p_items: items, p_carreras: drafts[0]?.destinos ?? [] });
  if (error) fail(error);
  const r = data as RpcResult;
  return { nuevas: r.nuevas, actualizadas: r.actualizadas, sinCambios: r.sin_cambios };
}

/** Bitácora del lote (sin el JSON). */
export async function registrarLote(lote: {
  archivo: string;
  institucionId: string | null;
  carreras: string[];
  total: number;
  omitidas: number;
  resultado: ImportPlan;
}) {
  const { error } = await supabase.from("lotes_importacion").insert({
    archivo: lote.archivo,
    institucion_id: lote.institucionId,
    carreras: lote.carreras,
    total: lote.total,
    nuevas: lote.resultado.nuevas,
    actualizadas: lote.resultado.actualizadas,
    sin_cambios: lote.resultado.sinCambios,
    omitidas: lote.omitidas,
  });
  if (error) fail(error);
}

/** % por materia del examen oficial para esas carreras; reemplaza la dosificación anterior (la última guía manda). */
export async function guardarDosificacion(
  carreras: string[],
  d: { porClave: Record<string, number>; metodo: string; fuente: string; totalOficial: number | null; archivo: string }
) {
  const { error } = await supabase.rpc("guardar_dosificacion", {
    p_carreras: carreras,
    p_dosificacion: {
      por_materia: d.porClave,
      metodo: d.metodo,
      fuente: d.fuente,
      total_reactivos_oficial: d.totalOficial,
      archivo: d.archivo,
    },
  });
  if (error) fail(error);
}

/** Alta o cambio desde Captura / Edición: las carreras quedan exactamente como se marcaron. */
export async function saveQuestion(draft: PreguntaDraft): Promise<Pregunta> {
  const { error } = await supabase.rpc("importar_reactivos", {
    p_items: [await toPayload(draft)],
    p_carreras: draft.destinos,
    p_reemplazar_carreras: true,
  });
  if (error) fail(error);
  await loadMaterias();
  return (await getQuestion(draft.id))!;
}

export async function deleteQuestion(codigo: string): Promise<void> {
  const { error } = await supabase.from("reactivos").delete().eq("codigo", codigo);
  if (error) fail(error);
}

