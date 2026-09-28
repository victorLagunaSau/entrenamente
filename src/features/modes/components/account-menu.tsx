"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { LogOut, Settings, User } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = { alias: string; email: string; onLogout: () => void; leaving: boolean };

/** Botón redondo de perfil; despliega nombre, correo, Perfil, Configuración y Cerrar sesión. */
export function AccountMenu({ alias, email, onLogout, leaving }: Props) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = alias.trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Mi cuenta"
        className={cn(
          "grid size-10 place-items-center rounded-full border bg-card font-display font-bold text-brand-light transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          open && "border-brand-light/60 bg-accent"
        )}
      >
        {initial}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute top-12 right-0 z-40 w-64 overflow-hidden rounded-2xl border bg-card shadow-xl"
        >
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-semibold">{alias}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <ul className="p-1.5">
            <MenuItem icon={User} label="Perfil" />
            <MenuItem icon={Settings} label="Configuración" />
            <li className="my-1 border-t" aria-hidden />
            <MenuItem icon={LogOut} label={leaving ? "Cerrando sesión…" : "Cerrar sesión"} onClick={onLogout} disabled={leaving} />
          </ul>
        </div>
      )}
    </div>
  );
}

/** Sin `onClick` = opción aún no disponible. */
function MenuItem({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick?: () => void; disabled?: boolean }) {
  const pending = !onClick;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={pending || disabled}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {label}
        {pending && <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">Pronto</span>}
      </button>
    </li>
  );
}
