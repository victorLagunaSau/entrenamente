"use client";

import * as React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

import { cn } from "@/lib/utils";

import { KATEX_OPTIONS, splitFormTags } from "../lib/form-tags";

/**
 * Texto de un reactivo: lo que está fuera de (form)…(/form) es texto plano y cada bloque
 * se dibuja con KaTeX en línea. Una fórmula inválida se muestra como su LaTeX en rojo.
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = React.useMemo(() => splitFormTags(text).segments, [text]);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {segments.map((s, i) => {
        if (s.type === "text") return <React.Fragment key={i}>{s.value}</React.Fragment>;
        try {
          const html = katex.renderToString(s.value, KATEX_OPTIONS);
          return <span key={i} className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return (
            <code key={i} className="rounded bg-destructive/15 px-1 font-mono text-[0.85em] text-destructive" title="Fórmula inválida">
              {s.value}
            </code>
          );
        }
      })}
    </span>
  );
}
