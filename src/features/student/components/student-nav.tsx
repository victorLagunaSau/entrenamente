"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Flame, House, NotebookPen, User } from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = { label: string; icon: LucideIcon; target: string | null };

/** Sin `target` = sección aún no disponible. */
const ITEMS: NavItem[] = [
  { label: "Inicio", icon: House, target: "saludo" },
  { label: "Plan", icon: BookOpen, target: "plan" },
  { label: "Examen", icon: NotebookPen, target: "examen-libre" },
  { label: "Rachas", icon: Flame, target: "rachas" },
  { label: "Perfil", icon: User, target: null },
];

/** Pie del home como menú de app (estilo banca): lleva a cada módulo y marca el visible. */
export function StudentNav() {
  const [current, setCurrent] = React.useState("saludo");
  // Tras tocar una opción, el scroll suave no debe cambiar la marca hasta que termine.
  const lockedUntil = React.useRef(0);

  React.useEffect(() => {
    // Activa la última sección cuyo inicio ya pasó el 40 % de la pantalla; al fondo, la última.
    const update = () => {
      const sections = ITEMS.flatMap((i) => (i.target ? [document.getElementById(i.target)] : [])).filter(
        (el): el is HTMLElement => el !== null
      );
      if (sections.length === 0 || Date.now() < lockedUntil.current) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const passed = sections.filter((el) => el.getBoundingClientRect().top <= window.innerHeight * 0.4);
      const active = atBottom ? sections[sections.length - 1] : (passed[passed.length - 1] ?? sections[0]);
      setCurrent(active.id);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const go = (target: string) => {
    setCurrent(target);
    lockedUntil.current = Date.now() + 1000;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(target)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav
      aria-label="Menú del estudiante"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.target === current;
          return (
            <li key={item.label}>
              <button
                type="button"
                disabled={!item.target}
                onClick={() => item.target && go(item.target)}
                aria-current={active ? "true" : undefined}
                title={item.target ? undefined : "Próximamente"}
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40",
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
