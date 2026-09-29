"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, Users } from "lucide-react";

import { cn } from "@/lib/utils";

export const TUTOR_TABS = [
  { href: "/app/dashboard", label: "Estudiantes", icon: Users },
  { href: "/app/dashboard/analytics", label: "Estadísticas", icon: BarChart3 },
  { href: "/app/dashboard/billing", label: "Suscripción", icon: CreditCard },
] as const;


/** Marca una sección como módulo de la barra superior: `<section {...moduleProps("racha", "Racha")}>`. */
export const moduleProps = (id: string, label: string) => ({ id, "data-module": label });

type Module = { id: string; label: string };

// Alto del encabezado (h-16) + esta barra: lo que se descuenta al saltar a un módulo.
const OFFSET = 128;

/**
 * Barra superior con scroll horizontal: los módulos de la pestaña actual (las secciones marcadas con
 * `data-module`), resaltando el que se está viendo. Se arma sola al cambiar de pestaña o de contenido.
 */
export function ModuleBar() {
  const pathname = usePathname();
  const [modules, setModules] = React.useState<Module[]>([]);
  const [current, setCurrent] = React.useState("");
  // Tras tocar un módulo, su marca se queda hasta que la persona vuelva a desplazarse (aunque la página no alcance a subirlo).
  const locked = React.useRef(false);
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    const scan = () => {
      const next = [...document.querySelectorAll<HTMLElement>("main [data-module]")]
        .filter((el) => el.id && !el.closest("[aria-hidden=true]"))
        .map((el) => ({ id: el.id, label: el.dataset.module! }));
      setModules((prev) => (prev.length === next.length && prev.every((m, i) => m.id === next[i].id && m.label === next[i].label) ? prev : next));
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [pathname]);

  React.useEffect(() => {
    const update = () => {
      if (locked.current) return;
      const els = modules.map((m) => document.getElementById(m.id)).filter((el): el is HTMLElement => el !== null);
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const passed = els.filter((el) => el.getBoundingClientRect().top <= OFFSET + 40);
      setCurrent((atBottom ? els.at(-1) : passed.at(-1))?.id ?? els[0]?.id ?? "");
    };
    update();
    const unlockOnUserScroll = () => {
      locked.current = false;
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("wheel", unlockOnUserScroll, { passive: true });
    window.addEventListener("touchmove", unlockOnUserScroll, { passive: true });
    window.addEventListener("keydown", unlockOnUserScroll);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("wheel", unlockOnUserScroll);
      window.removeEventListener("touchmove", unlockOnUserScroll);
      window.removeEventListener("keydown", unlockOnUserScroll);
    };
  }, [modules]);

  // El módulo activo siempre visible dentro de la barra.
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-target="${current}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [current]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setCurrent(id);
    locked.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - OFFSET + 8, behavior: reduce ? "auto" : "smooth" });
  };

  if (modules.length < 2) return null;
  return (
    <nav aria-label="Módulos de esta sección" className="sticky top-16 z-20 -mx-4 border-b bg-background/85 px-4 backdrop-blur md:-mx-8 md:px-8 print:hidden">
      <ul ref={listRef} className="flex gap-2 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {modules.map((m) => {
          const active = m.id === current;
          return (
            <li key={m.id} className="shrink-0">
              <button
                type="button"
                data-target={m.id}
                aria-current={active ? "true" : undefined}
                onClick={() => go(m.id)}
                className={cn(
                  "h-9 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  active ? "border-secondary/60 bg-secondary/15 text-secondary" : "text-cool hover:bg-accent hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Menú de app fijo abajo: Estudiantes, Estadísticas y Suscripción (en todas las pantallas). */
export function TutorBottomNav() {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  return (
    <nav
      aria-label="Secciones del panel"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-3 sm:h-[4.5rem]">
        {TUTOR_TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:text-sm",
                  active ? "text-secondary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-14 place-items-center rounded-full transition-colors",
                    active && "bg-brand-gradient text-white shadow-glow-secondary"
                  )}
                >
                  <tab.icon className="size-5" aria-hidden />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
