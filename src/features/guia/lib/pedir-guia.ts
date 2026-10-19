"use client";

import * as React from "react";

const FLAG = "em.guia.pedida";
const EVENTO = "em-guia-pedida";

/**
 * Pide abrir la guía de uso (p. ej. desde el menú de cuenta). Si el home ya está abierto lo escucha al instante;
 * si no, la marca espera en sessionStorage a que el home se monte.
 */
export function pedirGuia() {
  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    // Sin almacenamiento: solo funciona si el home ya está abierto.
  }
  window.dispatchEvent(new Event(EVENTO));
}

function tomarPedido(): boolean {
  try {
    if (sessionStorage.getItem(FLAG) !== "1") return false;
    sessionStorage.removeItem(FLAG);
    return true;
  } catch {
    return false;
  }
}

/** En el home: llama `abrir` cuando alguien pidió la guía. `listo` = el home ya tiene sus datos. */
export function useGuiaPedida(abrir: () => void, listo: boolean) {
  const ref = React.useRef(abrir);
  React.useEffect(() => {
    ref.current = abrir;
  });

  React.useEffect(() => {
    if (!listo) return;
    if (tomarPedido()) ref.current();
    const onPedido = () => tomarPedido() && ref.current();
    window.addEventListener(EVENTO, onPedido);
    return () => window.removeEventListener(EVENTO, onPedido);
  }, [listo]);
}
