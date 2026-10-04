"use client";

import * as React from "react";
import Link from "next/link";
import { Flame, Plus, Power, Sparkles, Star, Zap } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { StudentCareer } from "../services/student-careers-service";
import { ADD_CAREER_PATH } from "../services/student-goals-service";
import type { StudentSummary } from "../services/student-service";

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Módulo 1 · Saludo: apodo (con fuego si hay rachas activas), plan, su meta inicial y "+ Carreras".
 * Con más de una carrera, "Ver más" abre la lista completa con el acceso para agregar otra.
 */
export function StudentWelcome({
  summary,
  careers,
  streakDays,
}: {
  summary: StudentSummary;
  /** Metas del alumno, la inicial primero. */
  careers: StudentCareer[];
  streakDays: number | null;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const initial = careers[0];
  const more = careers.length - 1;

  return (
    <section id="saludo" className="flex scroll-mt-20 flex-col gap-3 rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">¡Hola, {summary.alias}!</h1>
        {streakDays !== null && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-energy/15 px-2.5 py-1 text-sm font-bold text-energy"
            title={`Racha de ${streakDays} ${streakDays === 1 ? "día" : "días"}`}
          >
            <Flame className="size-5 fill-energy/40" aria-hidden />
            {streakDays}
            <span className="sr-only"> días de racha</span>
          </span>
        )}
      </div>
      <AccessChip access={summary.access} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {initial && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <UniversityBadge id={initial.universityId} label={initial.universityShort} size="sm" />
            <span className="min-w-0 truncate text-sm text-cool">
              <span className="text-muted-foreground">Meta inicial · </span>
              {initial.name}
            </span>
            {more > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="rounded-md text-sm font-semibold text-brand-light hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                +{more} · Ver más
              </button>
            )}
          </div>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href={ADD_CAREER_PATH}>
            <Plus /> Carreras
          </Link>
        </Button>
      </div>
      <CareersDialog careers={careers} open={showAll} onOpenChange={setShowAll} />
    </section>
  );
}

/** Informativo: todas sus carreras y el acceso para agregar más. */
function CareersDialog({
  careers,
  open,
  onOpenChange,
}: {
  careers: StudentCareer[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tus carreras</DialogTitle>
          <DialogDescription>
            Entrenas para {careers.length} carreras, cada una con el formato de examen de su universidad.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {careers.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border bg-background/40 p-3">
              <UniversityBadge id={c.universityId} label={c.universityShort} size="sm" />
              <span className="min-w-0 flex-1 text-sm font-medium text-balance">{c.name}</span>
              {i === 0 && <Star className="size-4 shrink-0 fill-gold text-gold" aria-label="Meta inicial" />}
            </li>
          ))}
        </ul>
        <Button variant="brand" asChild>
          <Link href={ADD_CAREER_PATH}>
            <Plus /> Agregar más carreras
          </Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function AccessChip({ access }: { access: StudentSummary["access"] }) {
  const { status, expiresAt, sponsorAlias, freeExamsLeft } = access;
  const until = expiresAt ? dateFmt.format(new Date(expiresAt)) : null;

  const content = {
    active: {
      icon: Zap,
      tone: "border-secondary/40 bg-secondary/10 text-secondary",
      text: `Acceso completo${sponsorAlias ? ` · patrocinado por ${sponsorAlias}` : ""}${until ? ` · hasta el ${until}` : ""}`,
    },
    free: {
      icon: Sparkles,
      tone: "border-brand-light/40 bg-primary/10 text-brand-light",
      text: `Plan gratuito · ${freeExamsLeft} ${freeExamsLeft === 1 ? "prueba disponible" : "pruebas disponibles"}`,
    },
    inactive: {
      icon: Power,
      tone: "border-gold/40 bg-gold/10 text-gold",
      text: "Acceso en pausa · activa un plan o canjea un cupón",
    },
  }[status];

  const Icon = content.icon;
  return (
    <span className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium", content.tone)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {content.text}
    </span>
  );
}
