"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, CalendarDays, ChevronRight, CircleAlert, History, Loader2, Trash2 } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NIVELES } from "@/features/exam/lib/libre";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { PanelShell } from "@/features/modes/components/panel-shell";
import { AddSchoolMenuItem } from "@/features/student/components/add-school-menu-item";
import { cn } from "@/lib/utils";

import {
  completedSessions,
  daysBetween,
  DIAS,
  estadoDe,
  ESTADOS,
  formatFull,
  formatWindow,
  nextAutoLevel,
  type StudentPlan,
  todayISO,
} from "../lib/plan";
import { cancelarPlan, getMyPlans, moverSesion } from "../services/plan-service";
import { PlanCalendar } from "./plan-calendar";
import { PlanTodayCard } from "./plan-cards";
import { PlanStats } from "./plan-stats";

/** Vista del plan (`?id=`): examen de hoy, calendario para reagendar, estadísticas y exámenes presentados. */
export function PlanPanel() {
  return (
    <ModeGuard mode="student">
      <PanelShell accountExtra={<AddSchoolMenuItem />}>
        <React.Suspense fallback={<Skeleton />}>
          <PlanView />
        </React.Suspense>
      </PanelShell>
    </ModeGuard>
  );
}

function Skeleton() {
  return <div className="h-40 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" aria-label="Cargando tu plan" />;
}

const dateTimeFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function PlanView() {
  const router = useRouter();
  const idParam = Number(useSearchParams().get("id"));
  const [plans, setPlans] = React.useState<StudentPlan[] | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [moveError, setMoveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getMyPlans()
      .then(setPlans)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No pudimos cargar tu plan."));
  }, []);

  // El ancla (#calendario, #estadisticas) existe hasta que carga el plan.
  React.useEffect(() => {
    if (!plans?.length || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [plans]);

  if (error) return <Alert text={error} />;
  if (!plans) return <Skeleton />;

  const plan = plans.find((p) => p.id === idParam) ?? plans[0];
  if (!plan) {
    return (
      <div className="flex flex-col items-start gap-4">
        <BackHome />
        <p className="text-sm text-muted-foreground">No tienes un plan activo. Créalo desde tu home.</p>
      </div>
    );
  }

  // Reagendar: se mueve al instante y se revierte si la base lo rechaza.
  const move = (sessionId: number, date: string) => {
    const before = plans;
    const update = (list: StudentPlan[] | undefined) =>
      list?.map((p) =>
        p.id !== plan.id
          ? p
          : { ...p, sessions: p.sessions.map((s) => (s.id === sessionId ? { ...s, date } : s)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id) }
      );
    setMoveError(null);
    setPlans(update);
    moverSesion(sessionId, date).catch((e: unknown) => {
      setPlans(before);
      setMoveError(e instanceof Error ? e.message : "No pudimos mover el examen.");
    });
  };

  const today = todayISO();
  const left = daysBetween(today, plan.officialDate);
  const done = completedSessions(plan);
  const nivel = NIVELES.find((n) => n.value === nextAutoLevel(plan))?.nombre;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <BackHome />
        {plans.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Mis planes">
            {plans.map((p) => (
              <Button key={p.id} variant={p.id === plan.id ? "secondary" : "outline"} size="sm" onClick={() => router.replace(`?id=${p.id}`, { scroll: false })}>
                {p.universityKey} · {p.careerName}
              </Button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <UniversityBadge id={plan.universityKey.toLowerCase()} label={plan.universityKey} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-balance">Plan · {plan.careerName}</h1>
            <p className="text-sm text-muted-foreground">
              Examen oficial: {formatFull(plan.officialDate)}
              {left > 0 && (
                <>
                  {" "}
                  · faltan <strong className="text-secondary">{left} días</strong>
                </>
              )}
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-2 text-xs">
          <Chip>{DIAS.filter((d) => plan.practiceDays.includes(d.key)).map((d) => d.nombre.slice(0, 3)).join(" · ")}</Chip>
          <Chip>{plan.examsPerDay === 1 ? "1 examen por día" : `${plan.examsPerDay} exámenes por día`}</Chip>
          <Chip>
            {plan.difficultyMode === "automatic" ? `Dificultad automática · siguiente: ${nivel}` : `Dificultad fija · ${nivel}`}
          </Chip>
          <Chip>{formatWindow(plan.timeWindow)}</Chip>
        </ul>
      </div>

      <PlanTodayCard plan={plan} className="max-w-xl" />

      <Section id="calendario" title="Calendario" icon={CalendarDays}>
        {moveError && (
          <p role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" /> {moveError}
          </p>
        )}
        <div className="rounded-2xl border bg-card p-3 sm:p-5">
          <PlanCalendar key={plan.id} plan={plan} onMove={move} />
        </div>
      </Section>

      <Section id="estadisticas" title="Estadísticas" icon={BarChart3}>
        <PlanStats plan={plan} />
      </Section>

      <Section id="examenes" title="Exámenes presentados" icon={History}>
        {done.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no presentas exámenes de este plan.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...done].reverse().map((s) => {
              const estado = ESTADOS[estadoDe(s.exam.score)];
              return (
                <li key={s.id}>
                  <Link
                    href={`/app/student/exam/resultado?folio=${encodeURIComponent(s.exam.folio)}`}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-foreground/30"
                  >
                    <span className={cn("grid size-11 shrink-0 place-items-center rounded-lg font-bold", estado.bg, estado.text)}>{s.exam.score}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold">
                        {NIVELES.find((n) => n.value === s.exam.level)?.nombre}
                        {s.kind === "refuerzo" && <span className="ml-2 text-xs font-medium text-energy">Refuerzo</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dateTimeFmt.format(new Date(s.exam.completedAt))} · Folio {s.exam.folio}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <CancelPlan
        plan={plan}
        onCancelled={() => {
          router.replace("/app/student");
        }}
      />
    </div>
  );
}

function BackHome() {
  return (
    <Button variant="ghost" size="sm" className="self-start" asChild>
      <Link href="/app/student">
        <ArrowLeft /> Inicio
      </Link>
    </Button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <li className="rounded-full border bg-card px-3 py-1 text-muted-foreground">{children}</li>;
}

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: typeof History; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-3">
      <h2 id={`${id}-title`} className="flex items-center gap-2.5 text-lg font-bold">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-brand-light">
          <Icon className="size-4" aria-hidden />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <BackHome />
      <p role="alert" className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="size-4 shrink-0" /> {text}
      </p>
    </div>
  );
}

function CancelPlan({ plan, onCancelled }: { plan: StudentPlan; onCancelled: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancelarPlan(plan.id);
      onCancelled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cancelar el plan.");
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="self-start text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 /> Cancelar plan
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar el plan de {plan.careerName}?</DialogTitle>
            <DialogDescription>
              Se quitan los exámenes pendientes de tu calendario. Los que ya presentaste y sus reportes se conservan. Después puedes crear un
              plan nuevo.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Conservar plan
            </Button>
            <Button variant="outline" className="border-destructive/50 text-destructive" onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="animate-spin motion-reduce:animate-none" />} Cancelar plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
