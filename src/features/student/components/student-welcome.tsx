"use client";

import { Flame, GraduationCap, Power, Sparkles, Zap } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { findCareer, findUniversity } from "@/features/registro/data/catalog";
import { cn } from "@/lib/utils";

import type { StudentSummary } from "../services/student-service";

const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });

/** Módulo 1 · Saludo: apodo (con fuego si hay rachas activas), plan y acceso a sus carreras. */
export function StudentWelcome({ summary, streakDays }: { summary: StudentSummary; streakDays: number | null }) {
  const university = findUniversity(summary.goal?.universityId ?? null);
  const career = findCareer(summary.goal?.universityId ?? null, summary.goal?.careerId ?? null);

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
        {university && career && (
          <div className="flex min-w-0 items-center gap-3">
            <UniversityBadge id={university.id} label={university.short} size="sm" />
            <span className="min-w-0 truncate text-sm text-cool">
              <span className="text-muted-foreground">Meta inicial · </span>
              {career.name}
            </span>
          </div>
        )}
        {/* Pendiente: la vista de carreras aún no existe. */}
        <Button variant="outline" size="sm" disabled title="Próximamente">
          <GraduationCap /> Ir a carreras
        </Button>
      </div>
    </section>
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
