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
  orden: number;
};

export const IDENTIDAD_COLUMNS =
  "id, clave, sigla, nombre, tipo, examen, color_primario, color_secundario, color_acento, icono_svg, logo_url, activo, orden";

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
  orden: r.orden,
});

export async function getIdentidades(): Promise<Identidad[]> {
  const { data, error } = await supabase.from("instituciones").select(IDENTIDAD_COLUMNS).order("orden");
  if (error) throw error;
  return (data as Row[]).map(toIdentidad);
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
