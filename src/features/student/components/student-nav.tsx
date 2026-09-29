"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpen, BookOpenCheck, CreditCard, Flame, NotebookPen, Rocket, Route } from "lucide-react";

import { cn } from "@/lib/utils";

export type NavItem = { label: string; icon: LucideIcon; target: string };

/** Home Pro. */
export const PRO_NAV: NavItem[] = [
  { label: "Plan", icon: BookOpen, target: "plan" },
  { label: "Examen", icon: NotebookPen, target: "examen-libre" },
  { label: "Rachas", icon: Flame, target: "rachas" },
];

/** Home Demo: su camino de exámenes gratis, su guía y lo que desbloquea el plan. */
export const DEMO_NAV: NavItem[] = [
  { label: "Ruta", icon: Route, target: "ruta" },
  { label: "Guía", icon: BookOpenCheck, target: "guia" },
  { label: "Ilimitado", icon: Rocket, target: "ilimitado" },
  { label: "Planes", icon: CreditCard, target: "planes" },
];

/** Sección visible + salto suave. Tras tocar una opción, el scroll no cambia la marca hasta que termine. */
function useSectionNav(items: NavItem[]) {
  const [current, setCurrent] = React.useState("");
  const lockedUntil = React.useRef(0);

  React.useEffect(() => {
    // Activa la última sección cuyo inicio ya pasó el 40 % de la pantalla; al fondo, la última; arriba (saludo), ninguna.
    const update = () => {
      const sections = items.map((i) => document.getElementById(i.target)).filter((el): el is HTMLElement => el !== null);
      if (sections.length === 0 || Date.now() < lockedUntil.current) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const passed = sections.filter((el) => el.getBoundingClientRect().top <= window.innerHeight * 0.4);
      const active = atBottom ? sections[sections.length - 1] : passed[passed.length - 1];
      setCurrent(active?.id ?? "");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  const go = (target: string) => {
    setCurrent(target);
    lockedUntil.current = Date.now() + 1000;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(target)?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };

  return { current, go };
}

/** Celular y tablet: pie fijo como menú de app (estilo banca). */
export function StudentNav({ items = PRO_NAV }: { items?: NavItem[] }) {
  const { current, go } = useSectionNav(items);

  return (
    <nav
      aria-label="Menú del estudiante"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-16 max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = item.target === current;
          return (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => go(item.target)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  active ? "text-secondary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-secondary/15")}>
                  <item.icon className="size-5" aria-hidden />
                </span>
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Computadora: los mismos accesos en la barra superior. */
export function StudentTopNav({ items = PRO_NAV }: { items?: NavItem[] }) {
  const { current, go } = useSectionNav(items);

  return (
    <nav aria-label="Secciones del home" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = item.target === current;
          return (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => go(item.target)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  active ? "bg-secondary/15 text-secondary" : "text-cool hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
