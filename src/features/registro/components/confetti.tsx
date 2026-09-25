"use client";

import * as React from "react";

// Celebración = momento de gamificación: aquí sí caben energía y oro junto a la marca.
const COLORS = ["var(--secondary)", "var(--primary)", "var(--brand-light)", "var(--gold)", "var(--energy)"];
const PIECES = 48;

/** Lluvia de confetti en CSS puro; se omite con `prefers-reduced-motion`. */
export function Confetti() {
  // Aleatorio solo en cliente para evitar diferencias de hidratación.
  const [pieces, setPieces] = React.useState<React.CSSProperties[]>([]);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPieces(
      Array.from({ length: PIECES }, () => {
        const size = 6 + Math.random() * 6;
        return {
          left: `${Math.random() * 100}%`,
          width: size,
          height: size * (Math.random() > 0.5 ? 0.45 : 1),
          background: COLORS[Math.floor(Math.random() * COLORS.length)],
          borderRadius: Math.random() > 0.7 ? "999px" : "2px",
          animation: `confetti-fall ${2.4 + Math.random() * 1.8}s cubic-bezier(.2,.6,.4,1) ${Math.random() * 0.6}s forwards`,
          ["--confetti-drift" as string]: `${(Math.random() - 0.5) * 30}vw`,
          ["--confetti-spin" as string]: `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540)}deg`,
        };
      })
    );
  }, []);

  if (!pieces.length) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((style, i) => (
        <span key={i} className="absolute top-0 opacity-0" style={style} />
      ))}
    </div>
  );
}
