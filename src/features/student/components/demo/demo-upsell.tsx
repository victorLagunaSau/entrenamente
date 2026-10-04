"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRight, CalendarDays, Check, ChevronDown, Flame, Infinity as InfinityIcon, Rocket, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { formatMxn } from "../../services/demo-service";
import { type Prices, StudentPlans } from "./demo-plans";

/** Qué CTA abrió el modal: ajusta su título. */
export type UnlockFocus = "racha" | "plan" | "carreras" | null;


type Benefit = {
  icon: LucideIcon;
  title: string;
  benefit: string;
  /** Justificación pedagógica. */
  why: string;
  cta?: { label: string; focus: Exclude<UnlockFocus, null> };
};

const BENEFITS: Benefit[] = [
  {
    icon: CalendarDays,
    title: "Crea planes de entrenamiento",
    benefit: "Tu estudio organizado según la fecha real de tu examen de admisión.",
    why: "Repartir la práctica en sesiones espaciadas hasta el día del examen consolida más que estudiar todo de golpe. El plan distribuye materias y ajusta la dificultad con tus resultados.",
    cta: { label: "Crear mi Plan Completo", focus: "plan" },
  },
  {
    icon: InfinityIcon,
    title: "Exámenes ilimitados",
    benefit: "Practica sin restricciones, en todas tus carreras.",
    why: "Responder obliga a recuperar lo aprendido, y esa práctica de evocación fija el conocimiento mejor que releer. Cada examen mezcla reactivos y variantes nuevas: no memorizas respuestas, dominas el tema.",
  },
  {
    icon: Flame,
    title: "Racha de mini-exámenes diarios",
    benefit: "Entrena 10 minutos al día para no perder tu racha de estudio.",
    why: "Un hábito corto y diario sostiene la retención activa: vuelves a ver lo que empezabas a olvidar justo antes de que se pierda.",
    cta: { label: "Activar Modo Racha", focus: "racha" },
  },
  {
    icon: Timer,
    title: "Metodología de presión real",
    benefit: "Responde con precisión y velocidad bajo la presión del tiempo.",
    why: "Cada examen corre con tiempo límite total y cronómetro por pregunta, con la apariencia de tu examen de admisión. Medimos cuánto tardas en cada reactivo para mostrarte dónde pierdes tiempo, y como ya conoces la presión, el día del examen te concentras en responder.",
  },
];

/**
 * "Entrena sin límites": letrero comercial y propuesta de valor con su porqué pedagógico (los planes van en su sección).
 * Modo Racha y Plan por fecha se ven aquí, bloqueados: su botón abre el modal de planes.
 */
export function UnlimitedSection({ prices, phrase, onUnlock }: { prices: Prices; phrase: string; onUnlock: (focus: UnlockFocus) => void }) {
  return (
    <section id="ilimitado" aria-labelledby="ilimitado-title" className="flex scroll-mt-20 flex-col gap-4">
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-6 text-white shadow-glow-secondary sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-16 -bottom-20 size-72 rounded-full bg-energy/40 blur-3xl" />
        <p className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-widest uppercase">
          <Rocket className="size-3.5" aria-hidden /> Plan Estudiante
        </p>
        <h2
          id="ilimitado-title"
          className="relative mt-3 font-display text-4xl font-extrabold tracking-tight text-balance [text-shadow:0_2px_12px_rgb(10_24_48/0.45)] sm:text-6xl"
        >
          Entrena sin límites
        </h2>
        <p className="relative mt-3 max-w-xl text-base text-white/90 text-pretty sm:text-lg">{phrase}</p>
        <p className="relative mt-5 text-sm font-semibold">
          <span className="text-2xl font-extrabold">{formatMxn(prices.monthly)}</span> MXN al mes
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b.title} className="rounded-3xl bg-gradient-to-br from-secondary/60 via-border to-primary/40 p-px">
            <div className="flex h-full flex-col gap-4 rounded-[calc(1.5rem-1px)] bg-card p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow-secondary">
                  <b.icon className="size-6" aria-hidden />
                </span>
                <h3 className="font-display text-lg leading-tight font-bold text-balance">{b.title}</h3>
              </div>
              <p className="text-cool text-pretty">{b.benefit}</p>
              <details className="group rounded-2xl bg-background/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-secondary [&::-webkit-details-marker]:hidden">
                  ¿Por qué funciona?
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground text-pretty">{b.why}</p>
              </details>
              {b.cta && (
                <button
                  type="button"
                  onClick={() => onUnlock(b.cta!.focus)}
                  className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-bold text-brand-light hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {b.cta.label} <ArrowRight className="size-4" aria-hidden />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Letrero flotante: siempre a la vista, sobre el menú inferior en celular. */
export function PaywallBar({ phrase, prices, onUnlock }: { phrase: string; prices: Prices; onUnlock: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 px-4 lg:bottom-4">
      <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-energy/40 bg-card/95 p-3 shadow-2xl backdrop-blur sm:p-4">
        <p className="hidden min-w-0 flex-1 text-sm font-medium text-pretty sm:block">{phrase}</p>
        <Button variant="energy" onClick={onUnlock} className="h-auto min-h-11 w-full py-2 whitespace-normal sm:w-auto sm:shrink-0">
          <Rocket /> Entrena sin límites · {formatMxn(prices.monthly)} MXN/mes
        </Button>
      </div>
    </div>
  );
}

const FOCUS_TITLES: Record<Exclude<UnlockFocus, null>, string> = {
  racha: "El Modo Racha es parte del Plan Estudiante",
  plan: "El Plan personalizado es parte del Plan Estudiante",
  carreras: "Varias carreras son parte del Plan Estudiante",
};

/** Frase propia del CTA que abrió el modal; sin ella va la de la campaña. */
const FOCUS_PHRASES: Partial<Record<Exclude<UnlockFocus, null>, string>> = {
  carreras: "Entrena para múltiples universidades (UNAM, IPN, UAM) desbloqueando tu Plan Estudiante Ilimitado.",
};

/** Modal de planes: la frase y los precios vienen de la campaña; el pago vive en /acceso-ilimitado. */
export function PlansDialog({
  open,
  focus,
  phrase,
  prices,
  onOpenChange,
}: {
  open: boolean;
  focus: UnlockFocus;
  phrase: string;
  prices: Prices;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <span className="grid size-12 place-items-center rounded-2xl bg-energy/15 text-energy">
            <Rocket className="size-6" aria-hidden />
          </span>
          <DialogTitle>{focus ? FOCUS_TITLES[focus] : "Entrena sin límites"}</DialogTitle>
          <DialogDescription>{(focus && FOCUS_PHRASES[focus]) || phrase}</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2 text-sm text-cool">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex items-center gap-3">
              <Check className="size-4 shrink-0 text-energy" aria-hidden /> {b.title}
            </li>
          ))}
        </ul>

        <div className="pt-3">
          <StudentPlans prices={prices} compact />
        </div>
        <DialogClose asChild>
          <Button variant="ghost" className="w-full">
            Seguir con mi prueba gratis
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
