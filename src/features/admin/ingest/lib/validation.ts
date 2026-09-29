import { hasLooseLatex, latexErrors, splitFormTags } from "@/features/exam/lib/form-tags";
import type { Institucion } from "@/features/escuelas/types";
import { type Dificultad, PONDERACIONES, type Ponderacion, type Respuesta } from "@/features/exam/types";

import type { Materia, PreguntaDraft } from "../types";
import { DIFICULTADES, findInstitucion, grupoDe, parseId } from "./catalog";

export type Issue = {
  level: "error" | "aviso";
  /** Ruta del campo: "pregunta", "respuestas.2.texto", "solucionPasoAPaso.0"… */
  field: string;
  message: string;
};

const FIELD_LABEL: Record<string, string> = {
  id: "id",
  institucion: "institución",
  materia: "materia",
  dificultad: "dificultad",
  valorPuntos: "valorPuntos",
  lecturaAsociada: "lecturaAsociada",
  pregunta: "pregunta",
  respuestas: "respuestas",
  solucionPasoAPaso: "solución",
  variantesAsociadas: "variantes",
  destinos: "carreras",
  fuenteDetallada: "fuenteDetallada",
};

/** "respuestas.2.texto" → "respuestas[2].texto" para el reporte. */
export const fieldLabel = (path: string) => {
  const [head, index, sub] = path.split(".");
  return `${FIELD_LABEL[head] ?? head}${index !== undefined ? `[${index}]` : ""}${sub ? `.${sub}` : ""}`;
};

/** Revisa las etiquetas (form) y el LaTeX de un texto. */
function reviewText(field: string, text: string, issues: Issue[]) {
  for (const e of splitFormTags(text).errors) issues.push({ level: "error", field, message: `Etiqueta ${e}.` });
  for (const e of latexErrors(text)) issues.push({ level: "error", field, message: `LaTeX inválido en «${e.latex.slice(0, 40)}»: ${e.message}` });
  if (hasLooseLatex(text)) issues.push({ level: "aviso", field, message: "Hay LaTeX fuera de (form)…(/form); se verá como código." });
}

/** Reglas del estándar para un reactivo ya normalizado (importador y captura manual). */
export function reviewPregunta(p: PreguntaDraft, { catalogo }: { catalogo: Institucion[] }): Issue[] {
  const issues: Issue[] = [];
  const add = (level: Issue["level"], field: string, message: string) => issues.push({ level, field, message });

  const id = parseId(p.id);
  if (!id) add("error", "id", "Formato esperado INSTITUCIÓN-ÁREA-MATERIA-000-V00 (ej. UNAM-A1-MAT-007-V03).");
  if (!findInstitucion(catalogo, p.institucion))
    add("error", "institucion", `Institución «${p.institucion}» no está en Escuelas y carreras (o está desactivada).`);
  else if (id && id.institucion !== p.institucion) add("error", "id", `El ID empieza con ${id.institucion} pero la institución es ${p.institucion}.`);
  if (!p.materia) add("error", "materia", "Falta la materia.");
  else if (id && id.materia !== p.materia) add("error", "id", `El ID trae la materia ${id.materia} pero la materia es ${p.materia}.`);
  if (!DIFICULTADES.some((d) => d.value === p.dificultad)) add("error", "dificultad", "Usa facil, media o dificil.");
  if (!(p.valorPuntos > 0)) add("error", "valorPuntos", "Debe ser mayor que 0.");
  else if (p.valorPuntos !== 1) add("aviso", "valorPuntos", `Vale ${p.valorPuntos} puntos (lo usual es 1.0).`);

  if (p.lecturaAsociada !== null) reviewText("lecturaAsociada", p.lecturaAsociada, issues);
  if (!p.pregunta.trim()) add("error", "pregunta", "La pregunta está vacía.");
  else reviewText("pregunta", p.pregunta, issues);

  // Respuestas ponderadas
  if (p.respuestas.length < 2) add("error", "respuestas", "Se necesitan al menos 2 opciones.");
  else if (p.respuestas.length !== 4) add("aviso", "respuestas", `Tiene ${p.respuestas.length} opciones (lo usual son 4).`);
  const ids = p.respuestas.map((r) => r.id);
  if (new Set(ids).size !== ids.length) add("error", "respuestas", "Hay opciones con el mismo id.");
  const correctas = p.respuestas.filter((r) => r.ponderacion === 1).length;
  if (correctas !== 1) add("error", "respuestas", `Debe haber exactamente una opción con ponderación 1.0 (hay ${correctas}).`);
  // Sin ignorar mayúsculas: en notación (genotipos B/b, fórmulas) la diferencia importa.
  const textos = p.respuestas.map((r) => r.texto.trim()).filter(Boolean);
  if (new Set(textos).size !== textos.length) add("aviso", "respuestas", "Hay opciones con el mismo texto.");
  p.respuestas.forEach((r, i) => {
    if (!r.texto.trim()) add("error", `respuestas.${i}.texto`, "Texto vacío.");
    else reviewText(`respuestas.${i}.texto`, r.texto, issues);
    if (!PONDERACIONES.includes(r.ponderacion)) add("error", `respuestas.${i}.ponderacion`, "Usa 1.0, 0.75, 0.5, 0.25 o 0.0.");
    if (r.ponderacion < 1 && !r.diagnosticoError?.trim()) add("aviso", `respuestas.${i}.diagnosticoError`, "Falta el diagnóstico del error.");
    if (r.diagnosticoError) reviewText(`respuestas.${i}.diagnosticoError`, r.diagnosticoError, issues);
  });

  if (p.solucionPasoAPaso.length === 0) add("aviso", "solucionPasoAPaso", "No tiene solución paso a paso.");
  p.solucionPasoAPaso.forEach((paso, i) => {
    if (!paso.trim()) add("error", `solucionPasoAPaso.${i}`, "Paso vacío.");
    else reviewText(`solucionPasoAPaso.${i}`, paso, issues);
  });

  // Las variantes son opcionales y pueden ser cualquier número (pueden llegar en otro lote):
  // solo se revisa que las listadas sean de la misma raíz.
  const grupo = grupoDe(p.id);
  for (const v of p.variantesAsociadas) {
    if (v === p.id) add("aviso", "variantesAsociadas", "Se lista a sí misma como variante.");
    else if (grupoDe(v) !== grupo) add("aviso", "variantesAsociadas", `${v} no pertenece a la raíz ${grupo}.`);
  }
  if (p.destinos.length === 0) add("error", "destinos", "Asigna al menos una carrera.");
  return issues;
}

/* ─────────────────────────── Importador JSON ─────────────────────────── */

export type Correction = string;

export type ImportRow = {
  index: number;
  id: string;
  draft: PreguntaDraft | null;
  issues: Issue[];
  /** Correcciones automáticas aplicadas al normalizar. */
  fixes: Correction[];
  /** Materia que el lote registraría en el catálogo. */
  materiaNueva: Materia | null;
  areaCarrera: string;
};


const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

// "0) Oxígeno." → "Oxígeno.": el número deja de coincidir en cuanto se barajan las opciones.
const NUMBERING = /^\s*\d{1,2}\)\s+/;
// La misma numeración metida dentro de la fórmula: "(form)0) e^{3}(/form)".
const NUMBERING_IN_FORM = /^\s*\(form\)\s*\d{1,2}\)\s+/;

/** Convierte un elemento del JSON al reactivo del banco (sin destinos: se asignan en el paso 2). */
function toRow(raw: unknown, index: number, materias: Materia[], defaults: Record<string, unknown>): ImportRow {
  const base: ImportRow = { index, id: "", draft: null, issues: [], fixes: [], materiaNueva: null, areaCarrera: "" };
  const fail = (message: string): ImportRow => ({ ...base, issues: [...base.issues, { level: "error", field: "estructura", message }] });
  if (!isObj(raw)) return fail("El elemento no es un objeto.");
  // Lo que no traiga el reactivo se toma del bloque "guia" del lote.
  const config = isObj(raw.configuracionExamen) ? { ...defaults, ...raw.configuracionExamen } : Object.keys(defaults).length ? defaults : null;
  const r = raw.reactivo;
  if (!isObj(config)) return fail("Falta el bloque configuracionExamen.");
  if (!isObj(r)) return fail("Falta el bloque reactivo.");
  base.id = str(r.id).trim();
  if (!Array.isArray(r.respuestas)) return fail("reactivo.respuestas debe ser una lista.");

  const institucion = str(config.claveInstitucion).trim().toUpperCase();
  const materiaNombre = str(config.materia).trim();
  const codigo = parseId(base.id)?.materia ?? "";
  const materia =
    materias.find((m) => normalize(m.nombre) === normalize(materiaNombre)) ?? materias.find((m) => m.clave === codigo) ?? null;
  if (!materia && codigo && materiaNombre) base.materiaNueva = { clave: codigo, nombre: materiaNombre };
  base.areaCarrera = str(config.areaCarrera);

  let numbered = false;
  const respuestas = r.respuestas.map((a, i): Respuesta => {
    const o = isObj(a) ? a : {};
    let texto = str(o.texto);
    if (NUMBERING.test(texto)) {
      texto = texto.replace(NUMBERING, "");
      numbered = true;
    } else if (NUMBERING_IN_FORM.test(texto)) {
      texto = texto.replace(NUMBERING_IN_FORM, "(form)");
      base.fixes.push(`Se quitó la numeración que quedó dentro de la fórmula (opción ${o.id ?? i}).`);
    }
    const ponderacion = Number(o.ponderacion) as Ponderacion;
    let diagnosticoError = typeof o.diagnosticoError === "string" && o.diagnosticoError.trim() ? o.diagnosticoError : null;
    if (ponderacion === 1 && diagnosticoError) {
      diagnosticoError = null;
      base.fixes.push(`Se quitó el diagnóstico de la opción correcta (id ${o.id ?? i}).`);
    }
    return { id: typeof o.id === "number" ? o.id : i, texto, ponderacion, diagnosticoError };
  });
  if (numbered) base.fixes.push("Se quitó la numeración «0) 1) 2)…» del texto de las opciones.");

  const lectura = typeof r.lecturaAsociada === "string" && r.lecturaAsociada.trim() ? r.lecturaAsociada : null;
  const draft: PreguntaDraft = {
    id: base.id,
    institucion,
    materia: materia?.clave ?? codigo,
    fuente: str(config.fuente),
    fuenteDetallada: str(r.fuenteDetallada),
    valorPuntos: typeof r.valorPuntos === "number" ? r.valorPuntos : 1,
    dificultad: str(r.dificultad) as Dificultad,
    lecturaAsociada: lectura,
    pregunta: str(r.pregunta),
    respuestas,
    solucionPasoAPaso: Array.isArray(r.solucionPasoAPaso) ? r.solucionPasoAPaso.map(str) : [],
    variantesAsociadas: Array.isArray(r.variantesAsociadas) ? r.variantesAsociadas.map(str).filter(Boolean) : [],
    destinos: [],
  };
  if (!materiaNombre) base.issues.push({ level: "error", field: "materia", message: "configuracionExamen.materia está vacía." });
  if (base.materiaNueva)
    base.issues.push({ level: "aviso", field: "materia", message: `Materia nueva «${materiaNombre}» (${codigo}); se agregará al catálogo.` });
  return { ...base, draft };
}

/** JSON.parse con el número de línea del error de sintaxis. */
export function parseJson(text: string): { ok: true; data: unknown } | { ok: false; syntaxError: string; line?: number } {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "JSON inválido.";
    const pos = Number(/position (\d+)/.exec(message)?.[1]);
    const line = Number.isFinite(pos) ? text.slice(0, pos).split("\n").length : undefined;
    return { ok: false, syntaxError: message, line };
  }
}

/** Datos generales del lote (formato { guia, reactivos }). */
export type Guia = Record<string, unknown>;

/**
 * Revisa cada elemento del lote ya leído (se usa también al reparar un reactivo a mano).
 * `institucion`: clave elegida en el paso 1; los reactivos de otra institución son error.
 */
export function reviewItems(
  items: unknown[],
  { materias, guia, catalogo, institucion }: { materias: Materia[]; guia?: Guia | null; catalogo: Institucion[]; institucion: string }
): ImportRow[] {
  const defaults: Record<string, unknown> = {};
  for (const k of ["claveInstitucion", "nombreCompleto", "areaCarrera", "fuente"]) if (guia && typeof guia[k] === "string") defaults[k] = guia[k];
  const rows = items.map((raw, i) => toRow(raw, i, materias, defaults));
  const seen = new Map<string, number>();
  for (const row of rows) {
    if (row.id) {
      if (seen.has(row.id)) row.issues.push({ level: "error", field: "id", message: `ID repetido en el lote (también en #${seen.get(row.id)! + 1}).` });
      else seen.set(row.id, row.index);
    }
    // Las carreras se asignan en el paso 1 para todo el lote: aquí se revisa con una ficticia para no marcar su falta.
    if (row.draft) {
      row.issues.push(...reviewPregunta({ ...row.draft, destinos: ["*"] }, { catalogo }));
      if (institucion && row.draft.institucion && row.draft.institucion !== institucion)
        row.issues.push({
          level: "error",
          field: "institucion",
          message: `El reactivo es de ${row.draft.institucion} pero el lote se está asignando a ${institucion}.`,
        });
    }
  }
  return rows;
}

const tally = (values: string[]) => values.reduce<Record<string, number>>((acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc), {});

/** Totales reales del lote con las mismas llaves que el bloque "guia". */
export function guiaTotals(items: unknown[]) {
  const rs = items.filter(isObj);
  const ids = rs.map((x) => (isObj(x.reactivo) ? str(x.reactivo.id) : ""));
  const base = ids.filter((id) => /-V01$/.test(id)).length;
  return {
    totalReactivos: rs.length,
    reactivosBase: base,
    variantes: rs.length - base,
    porMateria: tally(rs.map((x) => (isObj(x.configuracionExamen) ? str(x.configuracionExamen.materia) : ""))),
    porDificultad: tally(rs.map((x) => (isObj(x.reactivo) ? str(x.reactivo.dificultad) : ""))),
  };
}

/** Compara los totales que declara la guía con el contenido real. */
export function reviewGuia(guia: Guia, items: unknown[]): string[] {
  const real = guiaTotals(items);
  const out: string[] = [];
  for (const k of ["totalReactivos", "reactivosBase", "variantes"] as const)
    if (typeof guia[k] === "number" && guia[k] !== real[k]) out.push(`${k}: la guía dice ${guia[k]}, el lote trae ${real[k]}.`);
  for (const k of ["porMateria", "porDificultad"] as const) {
    const declared = guia[k];
    if (!isObj(declared)) continue;
    for (const key of new Set([...Object.keys(declared), ...Object.keys(real[k])]))
      if (declared[key] !== real[k][key]) out.push(`${k}.${key}: la guía dice ${declared[key] ?? 0}, el lote trae ${real[k][key] ?? 0}.`);
  }
  return out;
}

/** Lee el lote: lista de { configuracionExamen, reactivo } o { guia, reactivos: [...] }. */
export function parseLote(
  text: string
): { ok: true; items: unknown[]; guia: Guia | null } | { ok: false; syntaxError: string; line?: number } {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const data = parsed.data;
  const items = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.reactivos) ? data.reactivos : null;
  if (!items) return { ok: false, syntaxError: 'Se esperaba una lista de reactivos o un objeto { "guia": {…}, "reactivos": […] }.' };
  if (items.length === 0) return { ok: false, syntaxError: "El lote está vacío." };
  return { ok: true, items, guia: isObj(data) && isObj(data.guia) ? data.guia : null };
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === "error");

/* ─────────────────────────── Dosificación (guia.dosificacion) ─────────────────────────── */

export type DosificacionMateria = {
  /** Nombre tal como viene en porMateria. */
  nombre: string;
  /** Clave del banco (MAT…); null si no se pudo identificar. */
  clave: string | null;
  porcentaje: number;
  /** Reactivos de esa materia en este lote (0 = falta cargarlas). */
  enLote: number;
};

export type DosificacionReview = {
  materias: DosificacionMateria[];
  metodo: "oficial" | "estimado";
  fuente: string;
  totalOficial: number | null;
  carreras: string[];
  issues: Issue[];
  /** Lista para guardar: { clave: % } (null si hay errores). */
  porClave: Record<string, number> | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Revisa el bloque "dosificacion" de la guía: % del examen oficial por materia (suma 100.0, un decimal),
 * con todas las materias del lote y los mismos nombres que configuracionExamen.materia.
 * `carrerasElegidas`: nombres de las carreras marcadas en el paso 1 (a ellas se les guarda).
 * Devuelve null si el lote no trae dosificación.
 */
export function reviewDosificacion(
  guia: Guia | null,
  items: unknown[],
  { materias, institucion, carrerasElegidas }: { materias: Materia[]; institucion: string; carrerasElegidas: string[] }
): DosificacionReview | null {
  const d = guia?.dosificacion;
  if (!isObj(d)) return null;
  const issues: Issue[] = [];
  const add = (level: Issue["level"], message: string) => issues.push({ level, field: "dosificacion", message });

  // Materias del lote: nombre de configuracionExamen → clave del ID, y cuántos reactivos trae.
  const lote = new Map<string, { clave: string; n: number }>();
  for (const x of items.filter(isObj)) {
    const nombre = str(isObj(x.configuracionExamen) ? x.configuracionExamen.materia : "").trim() || str(guia?.materia).trim();
    const clave = parseId(str(isObj(x.reactivo) ? x.reactivo.id : "").trim())?.materia ?? "";
    if (!nombre) continue;
    const prev = lote.get(nombre);
    lote.set(nombre, { clave: prev?.clave || clave, n: (prev?.n ?? 0) + 1 });
  }

  const por = isObj(d.porMateria) ? d.porMateria : null;
  if (!por || Object.keys(por).length === 0) add("error", "Falta porMateria (porcentaje de cada materia).");
  const lista: DosificacionMateria[] = Object.entries(por ?? {}).map(([nombre, v]) => {
    const exacto = lote.get(nombre);
    const parecido = exacto ? null : [...lote].find(([n]) => normalize(n) === normalize(nombre));
    const clave =
      exacto?.clave || parecido?.[1].clave || materias.find((m) => normalize(m.nombre) === normalize(nombre))?.clave || null;
    const porcentaje = typeof v === "number" ? v : NaN;
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) add("error", `${nombre}: el porcentaje debe ser un número de 0 a 100.`);
    else if (round1(porcentaje) !== porcentaje) add("aviso", `${nombre}: ${porcentaje} lleva más de un decimal.`);
    if (!clave) add("error", `«${nombre}» no está en el catálogo de materias ni en los reactivos del lote.`);
    if (parecido) add("aviso", `«${nombre}» se escribe distinto en los reactivos («${parecido[0]}»); usa el mismo nombre.`);
    return { nombre, clave, porcentaje, enLote: exacto?.n ?? parecido?.[1].n ?? 0 };
  });

  const suma = round1(lista.reduce((s, m) => s + (Number.isFinite(m.porcentaje) ? m.porcentaje : 0), 0));
  if (por && suma !== 100) add("error", `Los porcentajes suman ${suma.toFixed(1)} y deben sumar 100.0.`);
  for (const [nombre] of lote)
    if (!(nombre in (por ?? {})) && !lista.some((m) => normalize(m.nombre) === normalize(nombre)))
      add("error", `La materia «${nombre}» tiene reactivos en el lote pero no aparece en porMateria.`);
  const repetidas = lista.filter((m, i) => m.clave && lista.findIndex((o) => o.clave === m.clave) !== i);
  for (const m of repetidas) add("error", `«${m.nombre}» es la misma materia (${m.clave}) que otra de la lista.`);

  const metodo = d.metodo === "oficial" || d.metodo === "estimado" ? d.metodo : "estimado";
  if (d.metodo !== metodo) add("aviso", `metodo debe ser "oficial" o "estimado"; se guardará como estimado.`);
  const total = d.totalReactivosExamenOficial;
  const totalOficial = typeof total === "number" && Number.isInteger(total) && total > 0 ? total : null;
  if (totalOficial === null) add("aviso", "totalReactivosExamenOficial debe ser un entero mayor que 0.");
  const clave = str(d.claveInstitucion).trim().toUpperCase();
  if (clave && institucion && clave !== institucion) add("aviso", `La dosificación es de ${clave} pero el lote se asigna a ${institucion}.`);

  const carreras = Array.isArray(d.carreras) ? d.carreras.map(str).filter(Boolean) : [];
  const elegidas = new Set(carrerasElegidas.map(normalize));
  const fuera = carreras.filter((c) => !elegidas.has(normalize(c)));
  if (fuera.length)
    add("aviso", `La guía menciona ${fuera.length === 1 ? "una carrera que no marcaste" : `${fuera.length} carreras que no marcaste`}: ${fuera.join(", ")}.`);

  const ok = !issues.some((i) => i.level === "error");
  return {
    materias: lista,
    metodo,
    fuente: str(d.fuente),
    totalOficial,
    carreras,
    issues,
    porClave: ok ? Object.fromEntries(lista.map((m) => [m.clave!, round1(m.porcentaje)])) : null,
  };
}
