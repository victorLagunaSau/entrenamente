import type * as React from "react";

import type { Identidad } from "../types";
import { textOn } from "./color";

/** Claves con las que el front busca a una institución: su id y su clave en minúsculas (exámenes congelados). */
export const identidadKeys = (i: Pick<Identidad, "id" | "clave">) => [...new Set([i.id, i.clave.toLowerCase()])];

/**
 * Variables CSS globales por institución, inyectadas por IdentidadProvider:
 * --uni-<key> (primario), --uni-<key>-fg (texto encima), --uni-<key>-2 (secundario), --uni-<key>-accent.
 */
export function identidadCss(identidades: Identidad[]) {
  const rules: string[] = [];
  for (const i of identidades) {
    if (!i.colorPrimario) continue;
    const vars = [
      `#K: ${i.colorPrimario}`,
      `#K-fg: ${textOn(i.colorPrimario)}`,
      `#K-2: ${i.colorSecundario ?? i.colorPrimario}`,
      `#K-accent: ${i.colorAcento ?? i.colorSecundario ?? i.colorPrimario}`,
    ];
    for (const key of identidadKeys(i)) {
      if (!/^[a-z0-9-]+$/.test(key)) continue;
      rules.push(...vars.map((v) => v.replace("#K", `--uni-${key}`)));
    }
  }
  return rules.length ? `:root{${rules.join(";")}}` : "";
}

/** Colores de una institución para un contenedor (ficha, tarjeta): --school-primary, -secondary, -accent, -on-primary. */
export function schoolVars(key: string | null | undefined, fallback = "#1a1a1a"): React.CSSProperties {
  const primary = key ? `var(--uni-${key}, ${fallback})` : fallback;
  return {
    "--school-primary": primary,
    "--school-secondary": key ? `var(--uni-${key}-2, ${primary})` : primary,
    "--school-accent": key ? `var(--uni-${key}-accent, ${primary})` : primary,
    "--school-on-primary": key ? `var(--uni-${key}-fg, #ffffff)` : "#ffffff",
  } as React.CSSProperties;
}
