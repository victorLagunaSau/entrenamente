/**
 * Mismas reglas que `public.svg_seguro()` en Supabase, para avisar al admin antes de guardar.
 * De todos modos el SVG nunca se inserta en el DOM: SchoolIcon lo usa como máscara CSS.
 */
export function svgProblem(svg: string): string | null {
  const s = svg.trim();
  if (!s) return null;
  if (s.length > 20000) return "El SVG es demasiado grande (máximo 20,000 caracteres).";
  if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(s) || !/<\/svg>$/i.test(s)) return "Pega el código completo, de <svg …> a </svg>.";
  if (/<\s*(script|foreignobject|iframe|embed|object|image|use|style|a)[\s>/]/i.test(s))
    return "El SVG trae elementos no permitidos (script, image, use, style, enlaces…). Usa solo trazos y formas.";
  if (/\son[a-z]+\s*=/i.test(s)) return "El SVG trae eventos (onload, onclick…), que no están permitidos.";
  if (/(javascript|vbscript|data):/i.test(s) || /(href|src)\s*=\s*["']?\s*[a-z]+:/i.test(s) || /url\(\s*["']?\s*[a-z]+:/i.test(s))
    return "El SVG no puede cargar recursos de otros sitios.";
  return null;
}

/** El SVG como imagen para `mask-image` (no ejecuta nada aunque traiga código). */
export const svgDataUrl = (svg: string) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}")`;
