"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Check, FileDown, FileText, ListOrdered, Loader2, Scale, Stethoscope, Target, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { TrainButton, useLandingSession } from "./train-cta";

/** Ciclo de aprender del error, como ilustración: del tache a la palomita. */
const CICLO = [
  {
    icon: X,
    tone: "bg-energy text-background shadow-glow-energy",
    title: "Te equivocas",
    body: (
      <span className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-energy/15 px-2 py-0.5 font-mono text-xs font-bold text-energy">0.5 pts</span>
        Elegiste $728 en lugar de $696.
      </span>
    ),
  },
  {
    icon: Stethoscope,
    tone: "bg-gold text-background",
    title: "Entiendes por qué",
    body: "Restaste los porcentajes en vez de multiplicarlos.",
  },
  {
    icon: ListOrdered,
    tone: "bg-primary text-white shadow-glow-primary",
    title: "Ves la ruta correcta",
    body: <span className="font-mono text-xs">800 × 0.75 × 1.16 = 696</span>,
  },
  {
    icon: Check,
    tone: "bg-secondary text-secondary-foreground shadow-glow-secondary",
    title: "La próxima vez aciertas",
    body: (
      <span className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-secondary/15 px-2 py-0.5 font-mono text-xs font-bold text-secondary">1.0 pts</span>
        Ese error ya no se repite.
      </span>
    ),
  },
];

function ErrorCycle() {
  return (
    <div aria-hidden className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-b from-energy/25 via-gold/10 to-secondary/25 blur-3xl" />
      <ol className="relative flex flex-col gap-4 rounded-3xl border bg-card/80 p-5 shadow-2xl sm:p-7">
        {/* Línea que va del naranja (error) al turquesa (dominio). */}
        <span className="absolute top-12 bottom-12 left-[2.6rem] w-0.5 bg-gradient-to-b from-energy via-gold to-secondary sm:left-[3.1rem]" />
        {CICLO.map(({ icon: Icon, ...c }, i) => (
          <li
            key={c.title}
            className={cn(
              "relative flex gap-4 rounded-2xl p-3",
              i === 0 && "animate-float",
              i === CICLO.length - 1 && "animate-float-slow border border-secondary/30 bg-secondary/5"
            )}
          >
            <span className={cn("relative z-10 grid size-10 shrink-0 place-items-center rounded-full", c.tone)}>
              <Icon className="size-5" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Paso {i + 1}</p>
              <p className="font-display text-lg font-semibold">{c.title}</p>
              <div className="mt-1 text-sm text-cool">{c.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const INCLUYE = [
  {
    icon: Scale,
    title: "Respuestas ponderadas",
    body: "Cada opción vale 1, 0.75, 0.5, 0.25 o 0 puntos: sabes qué tan cerca estuviste del razonamiento correcto.",
  },
  {
    icon: Stethoscope,
    title: "Diagnóstico de cada error",
    body: "Por qué elegiste esa opción: trampa de lectura, fórmula confundida, error de signo o un paso olvidado.",
  },
  {
    icon: ListOrdered,
    title: "Solución paso a paso",
    body: "La ruta más rápida para resolverlo, en micro pasos que puedes descubrir uno por uno.",
  },
  {
    icon: Target,
    title: "Tus temas débiles por materia",
    body: "El número exacto de reactivos por repasar en cada materia: dejas de estudiar todo y estudias lo que te falta.",
  },
  {
    icon: FileDown,
    title: "En PDF, para estudiar donde sea",
    body: "Descarga tu Guía de errores al terminar cada examen.",
  },
];

export function ErrorGuide() {
  return (
    <section id="guia-errores" aria-labelledby="guia-errores-title" className="reveal mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading
        id="guia-errores-title"
        eyebrow="Tu Guía de errores"
        title={
          <>
            Equivócate aquí. <span className="text-brand-gradient">Aprende al instante.</span>
          </>
        }
        subtitle="No solo te decimos si está bien o mal: te decimos qué tan cerca estuviste y por qué."
      />

      <div className="mt-14 grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="px-2 sm:px-6 lg:px-0">
          <ErrorCycle />
        </div>

        <div className="flex flex-col gap-6">
          <p className="text-lg text-muted-foreground text-pretty">
            Equivocarte en un examen de práctica es la mejor oportunidad para aprender:{" "}
            <strong className="font-semibold text-cool">
              revisar la retroalimentación de cada error mejora lo que recuerdas el día del examen
            </strong>{" "}
            <cite className="text-sm whitespace-nowrap not-italic">(Butler y Roediger, 2008)</cite>. Por eso, al terminar cada
            examen recibes tu Guía de errores.
          </p>

          <ul className="flex flex-col gap-4">
            {INCLUYE.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <GuideDialog />
        </div>
      </div>
    </section>
  );
}

// El ejemplo usa los componentes del reporte real (y KaTeX): se descarga solo al abrir el diálogo.
const GuideExample = dynamic(() => import("./guide-example"), {
  ssr: false,
  loading: () => (
    <div className="grid h-60 place-items-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  ),
});

/** "Conoce la Guía de errores": ejemplo navegable y descargable sin salir de la landing. */
function GuideDialog() {
  const { loggedIn, homePath } = useLandingSession();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="energy" size="lg" className="mt-2 h-12">
          <FileText /> Conoce la Guía de errores
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-4 sm:max-h-[90dvh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Así se ve tu Guía de errores</DialogTitle>
          <DialogDescription>
            Ejemplo de un examen de la UNAM. Abre cada materia y cada pregunta para ver el diagnóstico y la solución paso a
            paso, o descárgala en PDF.
          </DialogDescription>
        </DialogHeader>
        <GuideExample />
        {loggedIn ? (
          <TrainButton href={homePath} size="lg" className="h-12 w-full" />
        ) : (
          <Button asChild variant="energy" size="lg" className="h-12 w-full">
            <Link href="/registro">
              Quiero la mía: inicia prueba gratis <ArrowRight />
            </Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
