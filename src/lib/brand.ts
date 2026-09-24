import type { Metadata } from "next";

/** Versiones de marca: cuaderno = estudiante, tabla con check = maestro. */
export type Audience = "estudiante" | "maestro";

const ASSETS = "/assets";

export const BRAND = {
  name: "Entrena Mente",
  tagline: "Simuladores de examen de admisión",
  themeColor: "#1590D6",
  background: "#0A1830",
} as const;

// Variantes "-color-oscuro": texto blanco + símbolo a color, pensadas para nuestro fondo navy.
export const LOGOS = {
  estudiante: {
    compact: { src: `${ASSETS}/imagotipoEstudiante/imagotipo-horizontal-compacto-color-oscuro.svg`, w: 1443, h: 360 },
    full: { src: `${ASSETS}/imagotipoEstudiante/imagotipo-horizontal-color-oscuro.svg`, w: 1490, h: 420 },
    vertical: { src: `${ASSETS}/imagotipoEstudiante/imagotipo-vertical-color-oscuro.svg`, w: 1000, h: 800 },
    app: { src: `${ASSETS}/isotipoEstudiante/isotipo-app.svg`, w: 1024, h: 1024 },
  },
  maestro: {
    compact: { src: `${ASSETS}/imagotipoMaestro/imagotipo-horizontal-compacto-color-oscuro.svg`, w: 1438, h: 360 },
    full: { src: `${ASSETS}/imagotipoMaestro/imagotipo-horizontal-color-oscuro.svg`, w: 1484, h: 420 },
    vertical: { src: `${ASSETS}/imagotipoMaestro/imagotipo-vertical-color-oscuro.svg`, w: 1000, h: 800 },
    app: { src: `${ASSETS}/isotipoMaestro/isotipo-app.svg`, w: 1024, h: 1024 },
  },
} as const;

export function brandIcons(audience: Audience): Metadata["icons"] {
  const base = `/favicon/${audience}`;
  return {
    icon: [
      { url: `${base}/favicon.ico`, sizes: "any" },
      { url: `${base}/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
      { url: `${base}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
      { url: `${base}/favicon-96x96.png`, sizes: "96x96", type: "image/png" },
    ],
    apple: { url: `${base}/apple-icon-180x180.png`, sizes: "180x180" },
    other: { rel: "mask-icon", url: `${base}/safari-pinned-tab.svg`, color: BRAND.themeColor },
  };
}
