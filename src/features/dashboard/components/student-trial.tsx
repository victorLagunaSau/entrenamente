"use client";

import Link from "next/link";
import { Hourglass, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { StudentAccess, TutorStudent } from "../services/tutor-service";

const DAY = 86_400_000;

/** Días que le quedan al periodo de prueba (0 = ya terminó). */
export function trialDaysLeft(endsAt: string, now = Date.now()) {
  return Math.max(Math.ceil((new Date(endsAt).getTime() - now) / DAY), 0);
}

/** Días totales del periodo (del registro al fin); 15 si no se conoce el registro. */
function trialLength(student: TutorStudent) {
  if (!student.trial || !student.registeredAt) return 15;
  return Math.max(Math.round((new Date(student.trial.endsAt).getTime() - new Date(student.registeredAt).getTime()) / DAY), 1);
}

const ACCESS: Record<StudentAccess, { label: string; tone: string; dot: string }> = {
  tutor: { label: "Activo", tone: "bg-success/15 text-success", dot: "bg-success" },
  otra: { label: "Activo (otra licencia)", tone: "bg-success/15 text-success", dot: "bg-success" },
  prueba: { label: "Prueba gratis", tone: "bg-gold/15 text-gold", dot: "bg-gold" },
  inactivo: { label: "Inactivo", tone: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

export function AccessBadge({ access }: { access: StudentAccess }) {
  const a = ACCESS[access];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", a.tone)}>
      <span className={cn("size-1.5 rounded-full", a.dot)} aria-hidden />
      {a.label}
    </span>
  );
}

/**
 * Contador de la prueba gratuita del estudiante: días restantes (desde su registro) y exámenes gratis usados.
 * Solo aplica mientras no tenga acceso pagado.
 */
export function TrialMeter({ student, compact }: { student: TutorStudent; compact?: boolean }) {
  const trial = student.trial;
  if (!trial || student.access === "tutor" || student.access === "otra") return null;
  const left = trialDaysLeft(trial.endsAt);
  const total = trialLength(student);
  const examsLeft = Math.max(trial.granted - trial.used, 0);
  const ended = left === 0 || examsLeft === 0;

  return (
    <div className={cn("flex flex-col gap-1.5", !compact && "rounded-lg border border-gold/30 bg-gold/5 p-3")}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gold">
        <Hourglass className="size-3.5" aria-hidden />
        {ended
          ? left === 0
            ? "Su prueba gratuita terminó"
            : "Ya usó todos sus exámenes gratis"
          : `${left} ${left === 1 ? "día" : "días"} de prueba gratis`}
      </p>
      <div
        role="meter"
        aria-label="Días de prueba restantes"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={left}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${Math.min(left / total, 1) * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        Exámenes gratis: {trial.used} de {trial.granted}
      </p>
    </div>
  );
}

/** Acción bloqueada mientras no hay plan: lleva a Suscripción. */
export function ActivateWithPlan({ label = "Activa con tu plan", className }: { label?: string; className?: string }) {
  return (
    <Button asChild variant="outline" size="sm" className={cn("border-gold/40 text-gold hover:bg-gold/10 hover:text-gold", className)}>
      <Link href="/app/dashboard/billing">
        <Lock /> {label}
      </Link>
    </Button>
  );
}
