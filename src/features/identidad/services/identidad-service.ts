/**
 * Identidad de instituciones en Supabase (tabla `instituciones`).
 * Lectura pública (RLS deja ver solo las activas; el admin ve todas). Escritura y logos: solo admin.
 */

import { supabase } from "@/lib/supabase/client";

import { normalizeHex } from "../lib/color";
import { svgProblem } from "../lib/svg";
import type { Identidad, IdentidadInput } from "../types";

type Row = {
  id: string;
  clave: string;
  sigla: string | null;
  nombre: string;
  tipo: Identidad["tipo"];
  examen: string | null;
  color_primario: string | null;
  color_secundario: string | null;
  color_acento: string | null;
  icono_svg: string | null;
  logo_url: string | null;
  activo: boolean;
  /** Pueden faltar mientras no se corre 20261015000000_escuelas_pais_estado.sql. */
  proximamente?: boolean;
  pais?: string | null;
  orden: number;
};

const COLUMNAS_BASE =
  "id, clave, sigla, nombre, tipo, examen, color_primario, color_secundario, color_acento, icono_svg, logo_url, activo, orden";

/** Lee `instituciones` con las columnas de identidad (RLS: activas y próximamente; el admin ve todas). */
export async function selectInstituciones(): Promise<Row[]> {
  const res = await supabase.from("instituciones").select(`${COLUMNAS_BASE}, proximamente, pais`).order("orden");
  if (!res.error) return res.data as Row[];
  // Sin la migración del país y estado: se lee lo de antes y todo cuenta como Activa / Inactiva.
  if (res.error.code !== "42703") throw res.error;
  const base = await supabase.from("instituciones").select(COLUMNAS_BASE).order("orden");
  if (base.error) throw base.error;
  return base.data as Row[];
}

export const toIdentidad = (r: Row): Identidad => ({
  id: r.id,
  clave: r.clave,
  sigla: r.sigla?.trim() || r.clave,
  nombre: r.nombre,
  tipo: r.tipo,
  examen: r.examen,
  colorPrimario: r.color_primario,
  colorSecundario: r.color_secundario,
  colorAcento: r.color_acento,
  iconoSvg: r.icono_svg,
  logoUrl: r.logo_url,
  activo: r.activo,
  proximamente: !r.activo && (r.proximamente ?? false),
  pais: r.pais ?? null,
  orden: r.orden,
});

export async function getIdentidades(): Promise<Identidad[]> {
  return (await selectInstituciones()).map(toIdentidad);
}

// Una sola lectura por sesión, compartida por el theme engine y el catálogo de carreras.
let pendiente: Promise<Identidad[]> | null = null;

/** Como getIdentidades, pero reutiliza la lectura en curso o ya hecha. `force` vuelve a leer (admin). */
export function cargarIdentidades({ force = false } = {}): Promise<Identidad[]> {
  if (force || !pendiente) {
    pendiente = getIdentidades().catch((e) => {
      pendiente = null;
      throw e;
    });
  }
  return pendiente;
}

/** Error con mensaje listo para la UI. */
export class IdentidadError extends Error {}

export async function actualizarIdentidad(id: string, input: IdentidadInput) {
  const sigla = input.sigla.trim();
  if (!sigla || sigla.length > 12) throw new IdentidadError("La sigla lleva de 1 a 12 caracteres.");
  const color = (v: string | null, label: string) => {
    if (!v?.trim()) return null;
    const hex = normalizeHex(v);
    if (!hex) throw new IdentidadError(`El color ${label} no es un HEX válido (ej. #002B7A).`);
    return hex;
  };
  const svg = input.iconoSvg?.trim() || null;
  const problem = svg && svgProblem(svg);
  if (problem) throw new IdentidadError(problem);

  const { error } = await supabase
    .from("instituciones")
    .update({
      sigla,
      color_primario: color(input.colorPrimario, "primario"),
      color_secundario: color(input.colorSecundario, "secundario"),
      color_acento: color(input.colorAcento, "de acento"),
      icono_svg: svg,
      logo_url: input.logoUrl || null,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "42501") throw new IdentidadError("No tienes permiso para editar la identidad.");
    if (error.code === "23514") throw new IdentidadError("Algún dato no pasó la validación (colores HEX o SVG no permitido).");
    if (error.code === "42703")
      throw new IdentidadError("Falta correr en Supabase la migración 20261003010000_identidad_instituciones.sql.");
    throw new IdentidadError(error.message);
  }
}

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };

/** Sube el logo al bucket `identidad` y regresa su URL pública. */
export async function subirLogo(id: string, file: File): Promise<string> {
  const ext = LOGO_TYPES[file.type];
  if (!ext) throw new IdentidadError("El logo debe ser PNG, WebP o SVG.");
  if (file.size > 1024 * 1024) throw new IdentidadError("El logo pesa más de 1 MB.");
  const path = `${id}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("identidad").upload(path, file, { contentType: file.type });
  if (error) throw new IdentidadError(`No se pudo subir el logo: ${error.message}`);
  return supabase.storage.from("identidad").getPublicUrl(path).data.publicUrl;
}
