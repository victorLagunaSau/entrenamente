"use client";

import * as React from "react";

import { schoolVars } from "@/features/identidad";

/**
 * Mimetización visual del examen: mientras el alumno está en el flujo del examen, TODA la interfaz
 * (barra, tarjetas, preguntas, diálogos) toma los colores de la institución. Se aplica sobre <html>
 * para que también alcance a los diálogos (se montan fuera del árbol) y se restaura al salir.
 *
 * Base clara neutra (blanco/gris) + los colores de la institución (identidad en Supabase, que
 * IdentidadProvider inyecta como --uni-<key>*) en la barra, títulos, botones, selección y progreso:
 * UNAM azul, POLI guinda, etc. Da la sensación de estar en su examen. También expone
 * --school-primary/-secondary/-accent/-on-primary para componentes que quieran mimetizarse.
 */

type ThemeVars = Record<`--${string}`, string>;

const NEUTRAL_LIGHT: ThemeVars = {
  "--background": "#f2f2f2",
  "--foreground": "#111111",
  "--card": "#ffffff",
  "--card-foreground": "#111111",
  "--popover": "#ffffff",
  "--popover-foreground": "#111111",
  "--surface-deep": "#111111",
  "--muted": "#e8e8e8",
  "--muted-foreground": "#5c5c5c",
  "--accent": "#ececec",
  "--accent-foreground": "#111111",
  "--border": "#d2d2d2",
  "--input": "#d2d2d2",
  "--text-cool": "#2a2a2a",
  "--gold": "#9a6700",
  "--energy": "#c2410c",
  "--destructive": "#c62828",
  "--success": "#1b7a43",
};

function varsFor(key: string | null): ThemeVars {
  // Sin color registrado para la institución: negro.
  const school = schoolVars(key) as ThemeVars;
  const color = school["--school-primary"];
  const onColor = school["--school-on-primary"];
  return {
    ...NEUTRAL_LIGHT,
    ...school,
    "--uni-bar": color,
    "--uni-accent": color,
    "--primary": color,
    "--primary-foreground": onColor,
    "--secondary": color,
    "--secondary-foreground": onColor,
    "--brand-light": color,
    "--brand-gradient": `linear-gradient(135deg, ${color} 0%, ${color} 100%)`,
    "--ring": color,
  };
}

/**
 * Aplica el tema institucional mientras el componente esté montado.
 * `institucion`: id o clave de la institución (null = neutro; undefined = aún no se sabe, no aplica nada).
 */
export function useUniTheme(institucion: string | null | undefined, enabled = true) {
  const key = institucion?.toLowerCase() ?? institucion;
  React.useLayoutEffect(() => {
    if (!enabled || key === undefined) return;
    const root = document.documentElement;
    const vars = varsFor(key);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset.uniTheme = key ?? "neutral";
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
      delete root.dataset.uniTheme;
    };
  }, [key, enabled]);
}
