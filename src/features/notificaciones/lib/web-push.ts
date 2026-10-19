/**
 * Push de la WebApp en este dispositivo: el navegador se suscribe (service worker /sw.js + clave VAPID pública) y la
 * suscripción se guarda con `registrar_dispositivo_push(json, 'web')`. Desde ahí `notificar()` deja una entrega push
 * y el despachador (/api/notificaciones/push) la manda aunque la app esté cerrada.
 * · El permiso solo se pide al tocar "Activar" (campana o Configuración), nunca al cargar.
 * · En iPhone/iPad solo funciona con la app instalada en la pantalla de inicio (iOS 16.4+).
 * · Al cerrar sesión o apagar el canal se quita la suscripción.
 */

import { Capacitor } from "@capacitor/core";

import { registerPushDevice, unregisterPushDevice } from "../services/notificaciones-service";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
// Apagó el push en este dispositivo desde Configuración: la campana ya no se lo vuelve a ofrecer.
const OFF_KEY = "em:push-apagado";

const remember = (off: boolean) => {
  try {
    if (off) localStorage.setItem(OFF_KEY, "1");
    else localStorage.removeItem(OFF_KEY);
  } catch {
    // Sin almacenamiento (modo privado): solo se vuelve a ofrecer.
  }
};

export function webPushTurnedOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * ready: se puede suscribir · install: iPhone/iPad en el navegador (falta instalar la app) ·
 * unsupported: navegador sin push, app nativa o sin clave VAPID.
 */
export type WebPushSupport = "ready" | "install" | "unsupported";

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export function webPushSupport(): WebPushSupport {
  if (typeof window === "undefined" || Capacitor.isNativePlatform() || !VAPID_PUBLIC_KEY) return "unsupported";
  if (isIos() && !isStandalone()) return "install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ready";
}

/** El service worker lo registra el layout; si aún no termina, se registra aquí (es idempotente). */
async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (webPushSupport() !== "ready") return null;
  try {
    return await (await registration()).pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function isWebPushSubscribed(): Promise<boolean> {
  return Boolean(await currentSubscription());
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** "iPhone · Safari", "Android · Chrome"… para reconocer el dispositivo. */
function deviceName(): string {
  const ua = navigator.userAgent;
  const os = isIos()
    ? /iPhone|iPod/.test(ua)
      ? "iPhone"
      : "iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "Navegador";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /Chrome|CriOS/.test(ua)
          ? "Chrome"
          : /Safari/.test(ua)
            ? "Safari"
            : "";
  return [os, browser].filter(Boolean).join(" · ");
}

/**
 * Pide el permiso (si hace falta), suscribe y guarda la suscripción. Llamar desde un toque del usuario.
 * Devuelve el permiso resultante; si este dispositivo no admite push, solo pide el permiso del navegador.
 */
export async function enableWebPush(): Promise<NotificationPermission> {
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted" || webPushSupport() !== "ready") return permission;
  const reg = await registration();
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));
  await registerPushDevice(JSON.stringify(subscription), "web", deviceName());
  remember(false);
  return permission;
}

/**
 * Quita la suscripción de la cuenta y del navegador. Nunca falla: cerrar sesión no debe trabarse por esto.
 * `turnedOff` = lo apagó la persona (no volver a ofrecerlo en la campana).
 */
export async function disableWebPush(turnedOff = false): Promise<void> {
  if (turnedOff) remember(true);
  const subscription = await currentSubscription();
  if (!subscription) return;
  await unregisterPushDevice(JSON.stringify(subscription)).catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
}

/**
 * Al abrir la app con sesión: si este navegador ya está suscrito, vuelve a guardar la suscripción (actualiza
 * last_seen_at y, si el navegador la renovó, guarda la nueva). No pide permisos ni suscribe por su cuenta.
 */
export async function syncWebPush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription || Notification.permission !== "granted") return;
  await registerPushDevice(JSON.stringify(subscription), "web", deviceName()).catch(() => undefined);
}
