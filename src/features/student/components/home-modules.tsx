"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookOpen, ChevronRight, Flame, NotebookPen, Plus } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { HomeCareer } from "../services/student-home-mock";

/** Estructura común: título del módulo y una fila por carrera configurada. */
function HomeModule({
  id,
  title,
  icon: Icon,
  tone,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  tone: "brand" | "secondary" | "energy";
  children: React.ReactNode;
}) {
  const iconTone = {
    brand: "bg-primary/15 text-brand-light",
    secondary: "bg-secondary/15 text-secondary",
    energy: "bg-energy/15 text-energy",
  }[tone];

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-3">
      <h2 id={`${id}-title`} className="flex items-center gap-2.5 text-lg font-bold">
        <span className={cn("grid size-8 place-items-center rounded-lg", iconTone)}>
          <Icon className="size-4" aria-hidden />
        </span>
        {title}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">{children}</ul>
    </section>
  );
}

function CareerLabel({ career }: { career: HomeCareer }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <UniversityBadge id={career.universityId} label={career.universityShort} size="sm" />
      <span className="min-w-0 truncate font-semibold">{career.name}</span>
    </span>
  );
}

const card = "flex h-full flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5";

/** Módulo 2 · Plan de estudios por carrera; si no existe, invita a crearlo. */
export function StudyPlanModule({ careers }: { careers: HomeCareer[] }) {
  return (
    <HomeModule id="plan" title="Plan de estudios" icon={BookOpen} tone="brand">
      {careers.map((career) => (
        <li key={career.id} className={card}>
          <CareerLabel career={career} />
          {career.planProgress === null ? (
            <Button variant="outline" className="w-full border-dashed" disabled title="Próximamente">
              <Plus /> Crea tu plan de estudios
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avance</span>
                <span className="font-semibold">{career.planProgress}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={career.planProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Avance del plan de ${career.name}`}
              >
                <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${career.planProgress}%` }} />
              </div>
            </div>
          )}
        </li>
      ))}
    </HomeModule>
  );
}

/** Módulo 3 · Un examen libre por carrera (el flujo ya recibe `?carrera=`). */
export function FreeExamModule({ careers }: { careers: HomeCareer[] }) {
  return (
    <HomeModule id="examen-libre" title="Examen libre" icon={NotebookPen} tone="secondary">
      {careers.map((career) => (
        <li key={career.id}>
          <Link
            href={`/app/student/exam?carrera=${encodeURIComponent(career.id)}`}
            className={cn(
              card,
              "group transition-colors hover:border-secondary/50 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            )}
          >
            <CareerLabel career={career} />
            <span className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Simulador completo de admisión</span>
              <span className="flex items-center gap-1 font-semibold text-secondary">
                Presentar
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </HomeModule>
  );
}

/** Módulo 4 · Rachas (micro exámenes). Se activan por carrera; la lógica llega después. */
export function StreaksModule({ careers, onActivate }: { careers: HomeCareer[]; onActivate: (careerId: string) => void }) {
  return (
    <HomeModule id="rachas" title="Rachas" icon={Flame} tone="energy">
      {careers.map((career) => {
        const active = career.streakDays !== null;
        return (
          <li key={career.id} className={cn(card, active && "border-energy/40")}>
            <CareerLabel career={career} />
            {active ? (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Flame className="size-7 fill-energy/40 text-energy" aria-hidden />
                  <span>
                    <span className="text-2xl font-bold text-energy">{career.streakDays}</span>
                    <span className="ml-1 text-sm text-muted-foreground">{career.streakDays === 1 ? "día" : "días"}</span>
                  </span>
                </span>
                <Button variant="energy" size="sm" disabled title="Próximamente">
                  Micro examen de hoy
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => onActivate(career.id)}>
                <Flame className="text-energy" /> Activar racha
              </Button>
            )}
          </li>
        );
      })}
    </HomeModule>
  );
}
