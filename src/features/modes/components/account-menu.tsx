"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LogOut, Settings, User } from "lucide-react";

import { UserAvatar } from "@/features/cuenta/components/user-avatar";
import { ACCOUNT_PATHS } from "@/features/cuenta/lib/paths";
import { cn } from "@/lib/utils";

type Props = {
  alias: string;
  email: string;
  avatarUrl: string | null;
  onLogout: () => void;
  leaving: boolean;
  extra?: React.ReactNode;
  /** Opciones que van al final, después de Configuración y antes de Cerrar sesión (p. ej. "Guía de uso"). */
  footerExtra?: React.ReactNode;
  /** Punto rojo en el avatar: hay algo pendiente (p. ej. la guía de uso sin completar). */
  pending?: boolean;
};

/** Botón redondo de perfil; despliega nombre, correo, opciones del home (`extra`), Perfil, Configuración y Cerrar sesión. */
export function AccountMenu({ alias, email, avatarUrl, onLogout, leaving, extra, footerExtra, pending }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={pending ? "Mi cuenta (tienes algo pendiente)" : "Mi cuenta"}
        className={cn(
          "relative rounded-full ring-2 ring-transparent transition-shadow hover:ring-brand-light/40 focus-visible:ring-ring/60 focus-visible:outline-none",
          open && "ring-brand-light/60"
        )}
      >
        <UserAvatar avatarUrl={avatarUrl} alias={alias} />
        {pending && <RedDot className="absolute top-0 right-0" />}
      </button>

      {open && (
        <div id={panelId} className="absolute top-12 right-0 z-40 w-64 overflow-hidden rounded-2xl border bg-card shadow-xl">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <UserAvatar avatarUrl={avatarUrl} alias={alias} className="size-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{alias}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          {/* Cualquier opción cierra el menú (también las extras del home). */}
          <ul className="p-1.5" onClick={(e) => (e.target as HTMLElement).closest("button") && setOpen(false)}>
            {extra}
            <MenuItem icon={User} label="Perfil" onClick={() => go(ACCOUNT_PATHS.perfil)} />
            <MenuItem icon={Settings} label="Configuración" onClick={() => go(ACCOUNT_PATHS.configuracion)} />
            {footerExtra && (
              <>
                <li className="my-1 border-t" aria-hidden />
                {footerExtra}
              </>
            )}
            <li className="my-1 border-t" aria-hidden />
            <MenuItem icon={LogOut} label={leaving ? "Cerrando sesión…" : "Cerrar sesión"} onClick={onLogout} disabled={leaving} />
          </ul>
        </div>
      )}
    </div>
  );
}

/** Sin `onClick` = opción aún no disponible. */
export function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  dot,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Punto rojo: algo pendiente en esta opción. */
  dot?: boolean;
}) {
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
        {dot && <RedDot className="ml-auto" label="Pendiente" />}
        {pending && <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">Pronto</span>}
      </button>
    </li>
  );
}

/** Aviso mínimo de "hay algo pendiente" (primer tipo de notificación). */
function RedDot({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn("size-3 shrink-0 rounded-full border-2 border-card bg-destructive", className)}>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
