import Link from "next/link";
import { ArrowRight, Check, GraduationCap, HeartHandshake, Presentation } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

const PLANS = [
  {
    id: "estudiante",
    icon: GraduationCap,
    audience: "Para aspirantes",
    title: "Plan Estudiante",
    body: "Crea tu ruta personalizada de preparación, haz simulacros de 10 minutos y mide tu progreso diariamente.",
    features: ["Ruta personalizada", "Simulacros de 10 minutos", "Progreso diario"],
    featured: true,
  },
  {
    id: "padres",
    icon: HeartHandshake,
    audience: "Para familias",
    title: "Plan Padres y Tutores",
    body: "Acompaña la preparación de tus hijos. Monitorea su porcentaje de aciertos por materia y evolución en una línea de tiempo desde tu propio panel.",
    features: ["Aciertos por materia", "Línea de tiempo de evolución", "Panel propio"],
  },
  {
    id: "docentes",
    icon: Presentation,
    audience: "Para escuelas",
    title: "Plan Docentes y Grupos",
    body: "Genera pruebas de ensayo en minutos para tus alumnos sin gastar tus exámenes oficiales y detecta lagunas del grupo antes de la evaluación real.",
    features: ["Pruebas de ensayo en minutos", "Cuida tus exámenes oficiales", "Detección de lagunas del grupo"],
  },
];

export function Plans() {
  return (
    <section id="planes" aria-labelledby="planes-title" className="reveal mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading
        id="planes-title"
        eyebrow="Planes"
        title={
          <>
            Entrenamiento a la medida para <span className="text-brand-gradient">alumnos, padres y docentes</span>
          </>
        }
      />

      <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {PLANS.map(({ icon: Icon, ...p }) => (
          <article
            key={p.id}
            className={cn(
              "relative flex flex-col rounded-3xl p-px",
              p.featured ? "bg-gradient-to-b from-energy via-energy/40 to-border lg:-translate-y-3" : "bg-border"
            )}
          >
            <div className="flex flex-1 flex-col rounded-[calc(1.5rem-1px)] bg-card p-6 sm:p-8">
              {p.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-energy px-3 py-1 text-xs font-bold text-background shadow-glow-energy">
                  Empieza aquí
                </span>
              )}
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-12 place-items-center rounded-2xl",
                    p.featured ? "bg-energy/15 text-energy" : "bg-secondary/15 text-secondary"
                  )}
                >
                  <Icon className="size-6" />
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{p.audience}</p>
                  <h3 className="text-xl font-semibold">{p.title}</h3>
                </div>
              </div>

              <p className="mt-5 text-muted-foreground">{p.body}</p>

              <ul className="mt-6 mb-8 flex flex-col gap-3 border-t pt-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-cool">
                    <Check className={cn("size-4 shrink-0", p.featured ? "text-energy" : "text-secondary")} />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                asChild
                size="lg"
                variant={p.featured ? "energy" : "outline"}
                className={cn("mt-auto h-12 w-full", !p.featured && "border-cool/25")}
              >
                <Link href={`/auth?mode=register&plan=${p.id}`}>
                  Probar gratis <ArrowRight />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
