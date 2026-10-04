"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, CircleAlert, CircleCheck, FileText, Library, NotebookPen } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { PanelShell } from "@/features/modes/components/panel-shell";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { getStudyGuides, type StudyGuide } from "../services/exam-record-service";
import { AddSchoolMenuItem } from "./add-school-menu-item";

/** Guías de estudio guardadas: una por cada examen libre presentado; `?carrera=` preselecciona el filtro. */
export function StudyGuidesPanel() {
  return (
    <ModeGuard mode="student">
      <PanelShell accountExtra={<AddSchoolMenuItem />}>
        <React.Suspense fallback={<Skeleton />}>
          <StudyGuides />
        </React.Suspense>
      </PanelShell>
    </ModeGuard>
  );
}

function Skeleton() {
  return <div className="h-40 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" aria-label="Cargando tus guías" />;
}

const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function StudyGuides() {
  const router = useRouter();
  const carrera = useSearchParams().get("carrera");
  const [guides, setGuides] = React.useState<StudyGuide[] | undefined>(undefined);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => (data.user ? getStudyGuides(data.user.id) : []))
      .then(setGuides)
      .catch(() => setFailed(true));
  }, []);

  // Una opción por carrera con guías.
  const careers = React.useMemo(() => {
    const map = new Map<string, { name: string; short: string }>();
    for (const g of guides ?? [])
      if (g.careerId && !map.has(g.careerId)) map.set(g.careerId, { name: g.careerName, short: g.universityShort });
    return [...map];
  }, [guides]);
  const selected = carrera;
  const visible = (guides ?? []).filter((g) => !selected || g.careerId === selected);
  const choose = (id: string | null) => router.replace(id ? `?carrera=${encodeURIComponent(id)}` : "?", { scroll: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start" asChild>
          <Link href="/app/student">
            <ArrowLeft /> Inicio
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Library className="size-6 text-secondary" aria-hidden /> Guías de errores
          </h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Cada examen libre deja su guía: las preguntas que fallaste, con su diagnóstico y la solución paso a paso.
          </p>
        </div>
      </div>

      {failed ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" /> No pudimos cargar tus guías. Recarga la página.
        </p>
      ) : guides === undefined ? (
        <Skeleton />
      ) : (
        <>
          {careers.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por carrera">
              <Chip active={!selected} onClick={() => choose(null)}>
                Todas · {guides.length}
              </Chip>
              {careers.map(([id, c]) => (
                <Chip key={id} active={selected === id} onClick={() => choose(id)}>
                  {c.short} · {c.name}
                </Chip>
              ))}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
              <FileText className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground text-pretty">
                Aún no tienes guías. Al terminar un examen libre, su guía se guarda aquí.
              </p>
              {carrera && (
                <Button variant="brand" asChild>
                  <Link href={`/app/student/exam?carrera=${encodeURIComponent(carrera)}`}>
                    <NotebookPen /> Presentar examen
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {visible.map((g) => (
                <GuideCard key={g.id} guide={g} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "max-w-full truncate rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "border-secondary/50 bg-secondary/15 text-secondary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function GuideCard({ guide: g }: { guide: StudyGuide }) {
  const clean = g.toReview === 0;
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <UniversityBadge id={g.universityId} label={g.universityShort} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{g.careerName}</p>
          <p className="text-xs text-muted-foreground">
            {dateFmt.format(new Date(g.date))} · {g.level}
          </p>
        </div>
        <span className="font-display text-2xl font-bold text-secondary">{g.score}%</span>
      </div>

      {clean ? (
        <p className="flex items-center gap-1.5 text-sm text-secondary">
          <CircleCheck className="size-4" aria-hidden /> Sin fallas: nada que repasar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            <span className="font-semibold">{g.toReview}</span> {g.toReview === 1 ? "pregunta" : "preguntas"} para repasar
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Materias a reforzar">
            {g.weakSubjects.slice(0, 3).map((m) => (
              <li key={m} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {m}
              </li>
            ))}
            {g.weakSubjects.length > 3 && <li className="px-1 text-xs text-muted-foreground">+{g.weakSubjects.length - 3}</li>}
          </ul>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="font-mono text-xs text-muted-foreground">{g.folio}</span>
        <Button variant={clean ? "outline" : "secondary"} size="sm" asChild>
          <Link href={`/app/student/exam/resultado?folio=${encodeURIComponent(g.folio)}`}>
            {clean ? "Ver reporte" : "Abrir guía"} <ChevronRight />
          </Link>
        </Button>
      </div>
    </li>
  );
}
