export const HEX_RE = /^#[0-9a-f]{6}$/i;

/** "#abc", "abc", "#AABBCC" → "#aabbcc"; null si no es un color válido. */
export function normalizeHex(value: string): string | null {
  let v = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, (c) => c + c);
  return /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : null;
}

// Luminancia relativa (WCAG 2.x).
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Texto legible encima de `hex`: blanco o casi negro, el que más contraste tenga. */
export const textOn = (hex: string) => (contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#111111") ? "#ffffff" : "#111111");
