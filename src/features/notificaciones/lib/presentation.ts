/**
 * Cómo se ve cada aviso según su código (ver docs/notificaciones-mapeo-eventos.md) y los dos avisos fuera de la
 * página: el contador en el título de la pestaña y la notificación del navegador.
 */

import type { LucideIcon } from "lucide-react";
import { Bell, CreditCard, PartyPopper, Send, Target, Users } from "lucide-react";

import type { AppNotification } from "../services/notificaciones-service";

/** Ícono por familia: P pagos, F familia, E entrenamiento, A1 bienvenida, T1 prueba. */
export function eventIcon(code: string): LucideIcon {
  if (code === "A1") return PartyPopper;
  if (code === "T1") return Send;
  switch (code[0]) {
    case "P":
      return CreditCard;
    case "F":
      return Users;
    case "E":
      return Target;
    default:
      return Bell;
  }
}

/** La bienvenida se ve como tarjeta destacada. */
export const isWelcome = (n: AppNotification) => n.eventCode === "A1";

// ───────────────────────── Pestaña ─────────────────────────

const COUNT_PREFIX = /^\(\d+\+?\)\s/;

/** "(3) Mi cuenta · Entrena Mente". Next cambia el título en cada página; quien lo llame debe repetirlo. */
export function applyTabCount(unread: number) {
  const base = document.title.replace(COUNT_PREFIX, "");
  const next = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${base}` : base;
  if (document.title !== next) document.title = next;
}

// ───────────────────────── Navegador ─────────────────────────

export const browserNotificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/**
 * Notificación del sistema mientras la pestaña está abierta pero en segundo plano (otra pestaña, ventana
 * minimizada). Con la pestaña cerrada no llega: eso es push (fase de apps / service worker).
 */
export function showBrowserNotification(n: AppNotification, onOpen: () => void) {
  if (!browserNotificationsSupported() || Notification.permission !== "granted" || !document.hidden) return;
  try {
    const shown = new Notification(n.title, {
      body: n.body,
      icon: "/favicon/estudiante/android-icon-192x192.png",
      tag: n.id,
    });
    shown.onclick = () => {
      window.focus();
      onOpen();
      shown.close();
    };
  } catch {
    // Algunos navegadores de celular solo permiten notificaciones desde un service worker.
  }
}
