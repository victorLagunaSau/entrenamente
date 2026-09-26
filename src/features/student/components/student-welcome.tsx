"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, LogOut, Power, Sparkles, Zap } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/services/auth-service";
import { findCareer, findUniversity } from "@/features/registro/data/catalog";
import { cn } from "@/lib/utils";

import { getStudentSummary, type StudentSummary } from "../services/student-service";

const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });

/** Saludo con datos reales: apodo, meta inicial y el "interruptor" de acceso. */
export function StudentWelcome() {
  const router = useRouter();
  const [summary, setSummary] = React.useState<StudentSummary | null | undefined>(undefined);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    getStudentSummary()
      .then(setSummary)
      .catch(() => setFailed(true));
  }, []);

  const logout = async () => {
    await signOut();
    router.replace("/login");
  };

  if (failed) {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="size-4 shrink-0" /> No pudimos cargar tu perfil. Recarga la página.
      </p>
    );
  }

  if (summary === undefined) {
    return <div className="h-40 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" aria-label="Cargando tu perfil" />;
  }
  if (!summary) return null;

  const university = findUniversity(summary.goal?.universityId ?? null);
  const career = findCareer(summary.goal?.universityId ?? null, summary.goal?.careerId ?? null);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 flex-col gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">¡Hola, {summary.alias}!</h1>
        <AccessChip access={summary.access} />
        {university && career && (
          <div className="flex min-w-0 items-center gap-3">
            <UniversityBadge id={university.id} label={university.short} size="sm" />
            <span className="min-w-0 truncate text-sm text-cool">
              <span className="text-muted-foreground">Meta inicial · </span>
              {career.name}
            </span>
          </div>
        )}
      </div>
      <Button variant="outline" onClick={logout} className="self-start sm:self-center">
        <LogOut /> Cerrar sesión
      </Button>
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
