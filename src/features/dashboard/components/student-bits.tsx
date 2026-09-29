"use client";

import { Flame, ThumbsUp, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import type { TutorExam } from "../services/tutor-service";

/** % de aciertos de un examen (preguntas correctas / preguntas, del resumen por materia). */
export const examAccuracy = (e: TutorExam) => {
  const total = e.materias.reduce((n, m) => n + m.total, 0);
  return total ? Math.round((100 * e.materias.reduce((n, m) => n + m.correctas, 0)) / total) : 0;
};

/** Preguntas sin acierto (incorrectas o sin responder). */
export const wrongOf = (e: TutorExam) => e.materias.reduce((n, m) => n + m.total - m.correctas, 0);

/** "en la UNAM", "en el IPN". */
export const articleFor = (u: string) => (/^(IPN|POLI|TEC)$/i.test(u) ? "el" : "la");

/** Escala del panel del tutor: <50 le falta práctica, 50–75 necesita reforzar, >75 excelente. */
export type Tone = "low" | "mid" | "high";

export const toneOf = (pct: number): Tone => (pct > 75 ? "high" : pct >= 50 ? "mid" : "low");

export const TONE: Record<Tone, { label: string; text: string; bg: string; bar: string; fill: string }> = {
  low: { label: "Le falta práctica", text: "text-energy", bg: "bg-energy/15", bar: "bg-energy", fill: "var(--energy)" },
  mid: { label: "Necesita reforzar", text: "text-gold", bg: "bg-gold/15", bar: "bg-gold", fill: "var(--gold)" },
  high: { label: "Excelente", text: "text-success", bg: "bg-success/15", bar: "bg-success", fill: "var(--success)" },
};

const ALERT_TONE = {
  low: {
    icon: TriangleAlert,
    tone: "border-energy/40 bg-energy/10",
    iconTone: "text-energy",
    title: "Le falta mucha práctica",
  },
  mid: { icon: ThumbsUp, tone: "border-gold/40 bg-gold/10", iconTone: "text-gold", title: "Muy bien, pero necesita reforzar" },
  high: { icon: Flame, tone: "border-success/40 bg-success/10", iconTone: "text-success", title: "¡Excelente! Que mantenga este ritmo" },
} as const;

/** Alerta según el % de aciertos promedio: <50 le falta práctica, 50–75 reforzar, >75 excelente. */
export function PerformanceAlert({ alias, accuracy, className }: { alias: string; accuracy: number; className?: string }) {
  const level = toneOf(accuracy);
  const a = ALERT_TONE[level];
  const detail = {
    low: `${alias} lleva ${accuracy}% de aciertos. Con práctica diaria y su guía de estudio sube rápido.`,
    mid: `${alias} lleva ${accuracy}% de aciertos. Va por buen camino: repasar sus fallas lo acerca a su meta.`,
    high: `${alias} lleva ${accuracy}% de aciertos. Está listo para subir de nivel.`,
  }[level];
  return (
    <div role="status" className={cn("flex gap-3 rounded-xl border p-3", a.tone, className)}>
      <a.icon className={cn("mt-0.5 size-5 shrink-0", a.iconTone)} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-bold">{a.title}</p>
        <p className="text-cool text-pretty">{detail}</p>
      </div>
    </div>
  );
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full bg-brand-gradient font-display font-bold text-white",
        size === "lg" && "size-16 text-2xl shadow-glow-secondary sm:size-20 sm:text-3xl",
        size === "md" && "size-12 text-lg",
        size === "sm" && "size-10 text-base",
        className
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
