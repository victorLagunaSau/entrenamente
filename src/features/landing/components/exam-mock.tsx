"use client";

import { useEffect, useState } from "react";
import { Check, Flame, Shuffle, Timer, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

const START = 9 * 60 + 58; // simulacro de 10 minutos

const OPTIONS = [
  { key: "A", text: "x = −3" },
  { key: "B", text: "x = 4" },
  { key: "C", text: "x = 6" },
  { key: "D", text: "x = 12" },
];

/** Ilustración viva del Hero: interfaz de examen flotante con temporizador activo. */
export function ExamMock() {
  const [seconds, setSeconds] = useState(START);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s <= 0 ? START : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const elapsed = 1 - seconds / START;

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      {/* Halo */}
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand-gradient opacity-25 blur-3xl" />
      <div className="absolute top-8 -right-6 -z-10 size-40 rounded-full bg-energy/30 blur-3xl" />

      <div className="animate-float rounded-3xl border border-white/10 bg-card/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
        {/* Cabecera */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Simulacro · UNAM</p>
            <p className="font-display text-sm font-semibold text-cool">Matemáticas · Reactivo 7 de 20</p>
          </div>
          <div className="animate-pulse-glow flex shrink-0 items-center gap-1.5 rounded-xl border border-energy/60 bg-energy/10 px-3 py-1.5">
            <Timer className="size-4 text-energy" />
            <span className="text-energy-glow font-mono text-lg font-bold tabular-nums">
              {mm}:{ss}
            </span>
          </div>
        </div>

        {/* Barra de tiempo */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-energy to-gold transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.max(4, elapsed * 100)}%` }}
          />
        </div>

        {/* Pregunta */}
        <div className="mt-5 rounded-2xl border bg-background/60 p-4">
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary/15 px-2 py-0.5 text-[11px] font-semibold text-secondary">
            <Shuffle className="size-3" /> Variante mutada
          </span>
          <p className="mt-3 font-display text-base font-semibold text-balance sm:text-lg">
            Si 3x − 7 = 2x + 5, ¿cuál es el valor de x?
          </p>
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-2.5">
          {OPTIONS.map((o) => {
            const selected = o.key === "D";
            return (
              <li
                key={o.key}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm",
                  selected ? "border-secondary bg-secondary/15 shadow-glow-secondary" : "bg-background/40"
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold",
                    selected ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {selected ? <Check className="size-3.5" /> : o.key}
                </span>
                <span className="font-medium">{o.text}</span>
              </li>
            );
          })}
        </ul>

        {/* Progreso */}
        <div className="mt-5 flex items-center gap-1.5">
          {Array.from({ length: 20 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i < 6 ? "bg-secondary" : i === 6 ? "bg-energy" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Chips flotantes */}
      <div className="animate-float-slow absolute -top-5 -left-3 flex items-center gap-2 rounded-2xl border border-energy/40 bg-surface-deep/90 px-3 py-2 shadow-xl backdrop-blur sm:-left-8">
        <Flame className="size-5 text-energy" />
        <div className="leading-tight">
          <p className="text-sm font-bold">12 días</p>
          <p className="text-[11px] text-muted-foreground">de racha</p>
        </div>
      </div>
      <div className="animate-float-slow absolute -right-2 -bottom-6 flex items-center gap-2 rounded-2xl border border-secondary/40 bg-surface-deep/90 px-3 py-2 shadow-xl backdrop-blur sm:-right-8">
        <TrendingUp className="size-5 text-secondary" />
        <div className="leading-tight">
          <p className="text-sm font-bold">+18% aciertos</p>
          <p className="text-[11px] text-muted-foreground">esta semana</p>
        </div>
      </div>
    </div>
  );
}
