"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, ListOrdered, RotateCcw, Scale, SearchCheck, Timer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { TrainButton, useLandingSession } from "./train-cta";

/** Reactivo de ejemplo con el mismo formato del banco: ponderación y diagnóstico en cada opción. */
const OPTIONS = [
  {
    key: "A",
    text: "$728",
    puntos: 0.5,
    diagnostico:
      "Restaste los porcentajes (25 % − 16 % = 9 %) y aplicaste solo un 9 % de descuento. Los porcentajes sucesivos no se suman ni se restan: se multiplican.",
  },
  {
    key: "B",
    text: "$696",
    puntos: 1,
    diagnostico: "Aplicaste el descuento y después el IVA sobre el precio ya rebajado. Razonamiento óptimo.",
  },
  {
    key: "C",
    text: "$600",
    puntos: 0.75,
    diagnostico: "El descuento está perfecto, pero te detuviste ahí: olvidaste sumar el IVA. Te faltó un paso.",
  },
  {
    key: "D",
    text: "$200",
    puntos: 0,
    diagnostico: "Trampa de lectura: calculaste cuánto te ahorras, no cuánto pagas. Vuelve a leer qué te preguntan.",
  },
];

const PASOS = [
  "Descuento: 800 × 0.75 = 600",
  "IVA sobre el precio con descuento: 600 × 1.16 = 696",
  "Atajo de examen: 800 × 0.75 × 1.16 = 696. Multiplica los factores, nunca sumes porcentajes.",
];

const PILARES = [
  {
    icon: Scale,
    title: "Respuestas ponderadas",
    body: "No solo bien o mal: cada opción vale 1, 0.75, 0.5, 0.25 o 0 puntos según qué tan cerca estuviste del razonamiento óptimo.",
  },
  {
    icon: SearchCheck,
    title: "Diagnóstico de cada error",
    body: "Cada opción incorrecta trae escrito por qué la elegiste: trampa de lectura, fórmula confundida, error de signo o un paso olvidado.",
  },
  {
    icon: ListOrdered,
    title: "Solución paso a paso",
    body: "Micro pasos con la ruta más rápida para resolverlo, listos en tu Guía de errores al terminar cada examen.",
  },
];

function tono(puntos: number) {
  if (puntos === 1) return { text: "text-secondary", border: "border-secondary", bg: "bg-secondary/15" };
  if (puntos >= 0.5) return { text: "text-gold", border: "border-gold", bg: "bg-gold/10" };
  return { text: "text-energy", border: "border-energy", bg: "bg-energy/10" };
}

export function TryQuestion() {
  const [elegida, setElegida] = React.useState<string | null>(null);
  const opcion = OPTIONS.find((o) => o.key === elegida);
  const { loggedIn, homePath } = useLandingSession();

  return (
    <section id="pruebalo" aria-labelledby="pruebalo-title" className="reveal mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading
        id="pruebalo-title"
        eyebrow="Anatomía de un reactivo"
        title={
          <>
            Equivócate aquí. <span className="text-brand-gradient">Aprende al instante.</span>
          </>
        }
        subtitle="Elige una respuesta. No solo te decimos si está bien o mal: te decimos qué tan cerca estuviste y por qué."
      />

      <div className="mt-14 grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
        {/* Reactivo interactivo */}
        <div className="rounded-3xl border bg-card/80 p-5 shadow-2xl sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-md bg-secondary/15 px-2 py-0.5 text-xs font-semibold text-secondary">
              Matemáticas · Dificultad media
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-energy">
              <Timer className="size-3.5" /> 1:30 para responder
            </span>
          </div>
          <p className="mt-4 font-display text-lg font-semibold text-pretty sm:text-xl">
            Una chamarra cuesta $800 y tiene 25 % de descuento. Al pagar se cobra 16 % de IVA sobre el precio con
            descuento. ¿Cuánto pagas en total?
          </p>

          <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {OPTIONS.map((o) => {
              const activa = o.key === elegida;
              const t = tono(o.puntos);
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    onClick={() => setElegida(o.key)}
                    aria-pressed={activa}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left font-medium transition-all",
                      activa ? cn(t.border, t.bg) : "bg-background/40 hover:border-cool/40 hover:bg-background/70"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold",
                        activa ? cn(t.bg, t.text) : "bg-muted text-muted-foreground"
                      )}
                    >
                      {activa ? o.puntos === 1 ? <Check className="size-4" /> : <X className="size-4" /> : o.key}
                    </span>
                    {o.text}
                  </button>
                </li>
              );
            })}
          </ul>

          <div aria-live="polite">
            {opcion ? (
              <div className="mt-6 flex flex-col gap-4 border-t pt-6">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-lg px-3 py-1 font-mono text-lg font-bold tabular-nums",
                      tono(opcion.puntos).bg,
                      tono(opcion.puntos).text
                    )}
                  >
                    {opcion.puntos.toFixed(2)} pts
                  </span>
                  <p className="text-sm font-semibold text-cool">
                    {opcion.puntos === 1 ? "¡Correcta!" : opcion.puntos > 0 ? "Parcialmente correcta" : "Incorrecta"}
                  </p>
                </div>
                <div className="rounded-2xl bg-background/60 p-4">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Diagnóstico</p>
                  <p className="mt-1.5 text-sm text-cool">{opcion.diagnostico}</p>
                </div>
                <div className="rounded-2xl bg-background/60 p-4">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    Solución paso a paso
                  </p>
                  <ol className="mt-2 flex flex-col gap-2">
                    {PASOS.map((p, i) => (
                      <li key={p} className="flex gap-3 text-sm text-cool">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary/15 text-[11px] font-bold text-secondary">
                          {i + 1}
                        </span>
                        {p}
                      </li>
                    ))}
                  </ol>
                </div>
                <Button variant="ghost" size="sm" className="w-fit" onClick={() => setElegida(null)}>
                  <RotateCcw /> Probar otra opción
                </Button>
              </div>
            ) : (
              <p className="mt-6 border-t pt-6 text-center text-sm text-muted-foreground">
                Toca una opción para ver su calificación y diagnóstico.
              </p>
            )}
          </div>
        </div>

        {/* Los 3 pilares de la evaluación */}
        <div className="flex flex-col gap-4">
          {PILARES.map(({ icon: Icon, ...p }) => (
            <article key={p.title} className="flex gap-4 rounded-2xl border bg-card/50 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary">
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </div>
            </article>
          ))}
          {loggedIn ? (
            <TrainButton href={homePath} size="lg" className="mt-2 h-12" />
          ) : (
            <Button asChild variant="energy" size="lg" className="mt-2 h-12">
              <Link href="/registro">
                Quiero mi Guía de errores <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
