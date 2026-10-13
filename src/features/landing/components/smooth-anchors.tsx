"use client";

import * as React from "react";

/** Más lejos = un poco más largo, pero nunca lento. */
const durationFor = (distance: number) => Math.min(1400, Math.max(550, 380 + Math.sqrt(distance) * 11));

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Enlaces internos de la landing (#planes, #guia-errores…) con un deslizamiento suave propio:
 * el nativo cruza miles de píxeles en menos de un segundo y las animaciones de aparición parpadean al pasar.
 * Durante el recorrido `html[data-jumping]` congela esas animaciones (ver globals.css).
 */
export function SmoothAnchors() {
  React.useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      delete root.dataset.jumping;
      root.style.scrollBehavior = "";
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      const id = link?.getAttribute("href")?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      history.pushState(null, "", `#${id}`);

      stop();
      // Primero se congelan las apariciones: con su desplazamiento la sección se mediría fuera de lugar.
      root.dataset.jumping = "";
      root.style.scrollBehavior = "auto";
      const offset = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
      const to = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
      const from = window.scrollY;
      const distance = Math.abs(to - from);

      if (distance < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.scrollTo({ top: to, behavior: "instant" });
        stop();
        return;
      }

      const duration = durationFor(distance);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        window.scrollTo({ top: from + (to - from) * easeInOutCubic(t), behavior: "instant" });
        if (t < 1) frame = requestAnimationFrame(step);
        else stop();
      };
      frame = requestAnimationFrame(step);
    };

    // Si la persona toca la pantalla o usa la rueda, manda ella.
    const interrupt = () => frame && stop();

    document.addEventListener("click", onClick);
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("keydown", interrupt);
    return () => {
      stop();
      document.removeEventListener("click", onClick);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("keydown", interrupt);
    };
  }, []);

  return null;
}
