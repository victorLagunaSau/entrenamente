"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

/** Registra /sw.js para que el sitio se pueda instalar como app (y reciba push). Las apps nativas no lo usan. */
export function ServiceWorker() {
  useEffect(() => {
    if (Capacitor.isNativePlatform() || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
