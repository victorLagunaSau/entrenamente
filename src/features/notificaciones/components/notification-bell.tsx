"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  applyTabCount,
  browserNotificationsSupported,
  eventIcon,
  isWelcome,
  showBrowserNotification,
} from "../lib/presentation";
import { enableWebPush, isWebPushSubscribed, syncWebPush, webPushSupport, webPushTurnedOff } from "../lib/web-push";
import { getInbox, markRead, subscribeToNew, type AppNotification, type Inbox } from "../services/notificaciones-service";

const REFRESH_MS = 60_000;
const TOAST_MS = 7_000;
const MAX_TOASTS = 3;

const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** "hace 5 minutos", "ayer"… */
function ago(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "justo ahora";
}

/**
 * Campana del header: contador de no leídos, últimos 10 avisos y "Marcar todas como leídas".
 * Los avisos nuevos llegan al instante (Realtime) y aparecen como aviso flotante unos segundos; además se
 * actualiza al abrir, cada minuto y al volver a la pestaña. Con avisos sin leer, la pestaña muestra "(n)" en su
 * título; si la pestaña está en segundo plano y el navegador dio permiso, sale también la notificación del sistema.
 * Si la bandeja aún no existe no se muestra.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [inbox, setInbox] = React.useState<Inbox | null>(null);
  const [unavailable, setUnavailable] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [marking, setMarking] = React.useState(false);
  const [toasts, setToasts] = React.useState<AppNotification[]>([]);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();
  // Avisos ya vistos: solo los nuevos (y sin leer) salen como aviso flotante. null = aún no hay primera carga.
  const seenRef = React.useRef<Set<string> | null>(null);
  // openItem se define más abajo; las notificaciones del navegador lo llaman al tocarse.
  const openRef = React.useRef<(n: AppNotification) => void>(() => {});
  const [permission, setPermission] = React.useState<NotificationPermission | "unsupported">("unsupported");

  // Push con la app cerrada: ofrecerlo si este dispositivo lo admite y aún no está suscrito.
  const [pushOffer, setPushOffer] = React.useState(false);

  React.useEffect(() => {
    if (browserNotificationsSupported()) setPermission(Notification.permission);
    syncWebPush();
    if (webPushSupport() === "ready" && !webPushTurnedOff()) isWebPushSubscribed().then((on) => setPushOffer(!on));
  }, [userId]);

  const dismissToast = React.useCallback((id: string) => setToasts((t) => t.filter((n) => n.id !== id)), []);

  /** Marca como vistos y saca como flotantes los que no se habían visto. */
  const announce = React.useCallback(
    (list: AppNotification[]) => {
      const seen = seenRef.current;
      if (!seen) {
        seenRef.current = new Set(list.map((n) => n.id));
        return;
      }
      const fresh = list.filter((n) => !seen.has(n.id) && !n.readAt);
      list.forEach((n) => seen.add(n.id));
      if (!fresh.length) return;
      setToasts((t) => [...fresh, ...t].slice(0, MAX_TOASTS));
      fresh.forEach((n) => {
        window.setTimeout(() => dismissToast(n.id), TOAST_MS);
        showBrowserNotification(n, () => openRef.current(n));
      });
    },
    [dismissToast]
  );

  const refresh = React.useCallback(async () => {
    try {
      const next = await getInbox(userId);
      announce(next.items);
      setInbox(next);
    } catch {
      setUnavailable(true);
    }
  }, [userId, announce]);

  // Tiempo real: el aviso entra a la lista, suma al contador y aparece flotando.
  React.useEffect(() => {
    if (unavailable) return;
    return subscribeToNew(userId, (n) => {
      if (seenRef.current?.has(n.id)) return;
      announce([n]);
      setInbox((prev) => prev && { items: [n, ...prev.items].slice(0, 10), unread: prev.unread + 1 });
    });
  }, [userId, unavailable, announce]);

  React.useEffect(() => {
    refresh();
    const timer = window.setInterval(() => document.visibilityState === "visible" && refresh(), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // "(n)" en la pestaña. Next reescribe el título al cambiar de página: se vuelve a poner cuando eso pasa.
  const unreadCount = inbox?.unread ?? 0;
  React.useEffect(() => {
    applyTabCount(unreadCount);
    const title = document.querySelector("title");
    if (!title) return;
    const observer = new MutationObserver(() => applyTabCount(unreadCount));
    observer.observe(title, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [unreadCount, pathname]);

  React.useEffect(() => () => applyTabCount(0), []);

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

  if (unavailable) return null;

  const unread = inbox?.unread ?? 0;
  const items = inbox?.items ?? [];

  const toggle = () => {
    setOpen((v) => !v);
    if (!open) refresh();
  };

  // Lectura optimista: la campana responde al instante y la base se pone al día detrás.
  const markLocal = (ids: string[] | null) =>
    setInbox((prev) => {
      if (!prev) return prev;
      const now = new Date().toISOString();
      let cleared = 0;
      const next = prev.items.map((n) => {
        if (n.readAt || (ids && !ids.includes(n.id))) return n;
        cleared++;
        return { ...n, readAt: now };
      });
      return { items: next, unread: ids ? Math.max(0, prev.unread - cleared) : 0 };
    });

  const openItem = (n: AppNotification) => {
    setOpen(false);
    dismissToast(n.id);
    if (!n.readAt) {
      markLocal([n.id]);
      markRead([n.id]).catch(refresh);
    }
    if (n.actionUrl) router.push(n.actionUrl);
  };
  openRef.current = openItem;

  // Se pide al tocar "Activar", nunca al cargar.
  const askPermission = async () => {
    try {
      const result = await enableWebPush();
      setPermission(result);
      if (result === "granted") setPushOffer(false);
    } catch {
      setPermission(Notification.permission);
    }
  };

  const markAll = async () => {
    setMarking(true);
    markLocal(null);
    setToasts([]);
    try {
      await markRead();
    } catch {
      await refresh();
    } finally {
      setMarking(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          open && "bg-accent text-foreground"
        )}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-destructive px-1 font-mono text-[10px] leading-none font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="fixed inset-x-4 top-16 z-40 overflow-hidden rounded-2xl border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <p className="text-sm font-semibold">Notificaciones</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                disabled={marking}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-light hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-60"
              >
                {marking ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
                Marcar todas como leídas
              </button>
            )}
          </div>

          {inbox === null ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-label="Cargando" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Bell className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground text-pretty">Aquí verás los avisos de tus exámenes, tu plan y tus pagos.</p>
            </div>
          ) : (
            <ul className="max-h-[min(28rem,70dvh)] divide-y overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                      !n.readAt && "bg-brand-light/5",
                      isWelcome(n) && "bg-primary/10"
                    )}
                  >
                    <EventIcon n={n} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm text-pretty", n.readAt ? "font-medium" : "font-semibold")}>
                        {n.title}
                        {!n.readAt && <span className="sr-only"> (sin leer)</span>}
                      </span>
                      <span className={cn("mt-0.5 block text-xs text-muted-foreground text-pretty", !isWelcome(n) && "line-clamp-2")}>
                        {n.body}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground/80">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(permission === "default" || (permission === "granted" && pushOffer)) && (
            <div className="flex items-center justify-between gap-3 border-t bg-background/40 px-4 py-3">
              <p className="text-xs text-muted-foreground text-pretty">
                {webPushSupport() === "ready"
                  ? "Recibe los avisos en este dispositivo aunque la app esté cerrada."
                  : "Recibe los avisos aunque estés en otra pestaña."}
              </p>
              <button
                type="button"
                onClick={askPermission}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-light hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <BellRing className="size-3.5" /> Activar
              </button>
            </div>
          )}
        </div>
      )}

      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 top-20 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6"
        >
          {toasts.map((n) => (
            <div
              key={n.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-brand-light/40 bg-card p-3 shadow-2xl shadow-glow-secondary motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-4"
            >
              <button type="button" onClick={() => openItem(n)} className="flex min-w-0 flex-1 gap-3 text-left focus-visible:outline-none">
                <EventIcon n={n} highlight />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-pretty">{n.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground text-pretty">{n.body}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => dismissToast(n.id)}
                aria-label="Cerrar aviso"
                className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ícono del tipo de aviso; con punto azul si no se ha leído. La bienvenida (y el aviso flotante) en degradado. */
function EventIcon({ n, highlight }: { n: AppNotification; highlight?: boolean }) {
  const Icon = eventIcon(n.eventCode);
  const strong = highlight || isWelcome(n);
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-xl",
        strong ? "bg-brand-gradient text-white" : "bg-muted text-brand-light"
      )}
      aria-hidden
    >
      <Icon className="size-4" />
      {!highlight && !n.readAt && (
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-brand-light" />
      )}
    </span>
  );
}
