import katex from "katex";

/**
 * Bloques de fórmula del estándar de ingesta: `(form)LaTeX(/form)`.
 * Se buscan los literales (no se cuentan paréntesis: una fórmula puede contener "(b)").
 * El texto llega ya decodificado del JSON: `\\frac` en el archivo es `\frac` aquí.
 */
export const FORM_OPEN = "(form)";
export const FORM_CLOSE = "(/form)";

export type Segment = { type: "text" | "math"; value: string };

export type FormTagError = "apertura sin cierre" | "cierre sin apertura" | "(form) anidado" | "fórmula vacía";

export function splitFormTags(text: string): { segments: Segment[]; errors: FormTagError[] } {
  const segments: Segment[] = [];
  const errors: FormTagError[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf(FORM_OPEN, i);
    const close = text.indexOf(FORM_CLOSE, i);
    if (close !== -1 && (open === -1 || close < open)) {
      errors.push("cierre sin apertura");
      segments.push({ type: "text", value: text.slice(i, close) });
      i = close + FORM_CLOSE.length;
      continue;
    }
    if (open === -1) {
      segments.push({ type: "text", value: text.slice(i) });
      break;
    }
    if (open > i) segments.push({ type: "text", value: text.slice(i, open) });
    const end = text.indexOf(FORM_CLOSE, open + FORM_OPEN.length);
    if (end === -1) {
      errors.push("apertura sin cierre");
      segments.push({ type: "text", value: text.slice(open) });
      break;
    }
    const nested = text.indexOf(FORM_OPEN, open + FORM_OPEN.length);
    if (nested !== -1 && nested < end) errors.push("(form) anidado");
    const latex = text.slice(open + FORM_OPEN.length, end);
    if (!latex.trim()) errors.push("fórmula vacía");
    segments.push({ type: "math", value: latex });
    i = end + FORM_CLOSE.length;
  }
  return { segments: segments.filter((s) => s.value !== ""), errors };
}

export const KATEX_OPTIONS = { throwOnError: true, strict: "ignore", output: "html" } as const;

/** Errores de sintaxis LaTeX de cada fórmula (vacío = todas se pueden dibujar). */
export function latexErrors(text: string): { latex: string; message: string }[] {
  return splitFormTags(text)
    .segments.filter((s) => s.type === "math" && s.value.trim())
    .flatMap((s) => {
      try {
        katex.renderToString(s.value, KATEX_OPTIONS);
        return [];
      } catch (err) {
        return [{ latex: s.value, message: err instanceof Error ? err.message.replace(/^KaTeX parse error: /, "") : String(err) }];
      }
    });
}

/** LaTeX escrito fuera de (form): se vería como código crudo. */
export function hasLooseLatex(text: string) {
  return splitFormTags(text).segments.some((s) => s.type === "text" && /\\[a-zA-Z]{2,}|\^\{|_\{/.test(s.value));
}

/** Texto plano para búsquedas y extractos: conserva el LaTeX sin las etiquetas. */
export const stripFormTags = (text: string) => text.split(FORM_OPEN).join("").split(FORM_CLOSE).join("");
