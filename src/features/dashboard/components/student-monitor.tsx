"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarPlus,
  CircleAlert,
  CircleCheck,
  Clock,
  Coffee,
  Flame,
  GraduationCap,
  Loader2,
  NotebookPen,
  Plus,
  Power,
  PowerOff,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserMinus,
  UserPlus,
} from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { diasDeRacha, NIVEL_JUEGO } from "@/features/exam/lib/racha";
import { PlanWeekStrip } from "@/features/plan/components/plan-cards";
import {
  completedSessions,
  daysBetween,
  DIAS,
  dueSessions,
  formatFull,
  formatWindow,
  recentAverage,
  type StudentPlan,
  todayISO,
  toISODate,
} from "@/features/plan/lib/plan";
import { cn } from "@/lib/utils";

import { formatDate, formatMxn, planName, TUTOR_COPY, upgradeOffers } from "../lib/tutor-plans";
import { computeStats, formatHours, type TutorStats } from "../lib/tutor-stats";
import {
  activateSeat,
  errorMessage,
  type ExamType,
  getStudentPlans,
  getTutorExams,
  releaseSeat,
  studentLimit,
  unlinkStudent,
  type TutorExam,
  type TutorStudent,
} from "../services/tutor-service";
import { GroupChips, GroupSelect, type GroupFilter } from "./groups";
import { InviteButton } from "./invite-dialog";
import { AddGoalDialog, CreatePlanDialog, ExamResultsDialog } from "./monitor-dialogs";
import { articleFor, Avatar, examAccuracy, PerformanceAlert, TONE, toneOf, wrongOf } from "./student-bits";
import { useTutor } from "./tutor-context";
import { moduleProps } from "./tutor-nav";

/* ─────────────────────────── Datos derivados por estudiante ─────────────────────────── */

type Insight = {
  list: TutorExam[];
  stats: TutorStats;
  /** Promedio de los últimos 3 exámenes (plan y libre; la racha es trivia corta). */
  recent: number | null;
  /** % de aciertos de los últimos 10 exámenes, para la mini gráfica. */
  trend: number[];
  racha: { days: number; playedToday: boolean; best: number; level: string | null; last14: { date: string; played: boolean }[] };
  week: { exams: number; seconds: number; byType: Record<ExamType, number> };
  todayExams: TutorExam[];
};

const DAY = 86_400_000;

function buildInsight(list: TutorExam[]): Insight {
  const stats = computeStats(list);
  const serious = list.filter((e) => e.type !== "racha");
  const last3 = serious.slice(-3);
  const recent = last3.length ? Math.round(last3.reduce((n, e) => n + examAccuracy(e), 0) / last3.length) : null;

  const rachaDates = list.filter((e) => e.type === "racha").map((e) => e.completedAt);
  const { dias, jugoHoy } = diasDeRacha(rachaDates);
  const played = new Set(rachaDates.map((d) => toISODate(new Date(d))));
  const sorted = [...played].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((d, i) => {
    run = i > 0 && Math.round((new Date(`${d}T12:00`).getTime() - new Date(`${sorted[i - 1]}T12:00`).getTime()) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  const today = new Date();
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = toISODate(new Date(today.getTime() - (13 - i) * DAY));
    return { date: d, played: played.has(d) };
  });
  const lastRacha = list.filter((e) => e.type === "racha").at(-1);

  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const thisWeek = list.filter((e) => new Date(e.completedAt) >= monday);
  const byType = { plan: 0, libre: 0, racha: 0 } as Record<ExamType, number>;
  thisWeek.forEach((e) => byType[e.type]++);
  const todayIso = todayISO();

  return {
    list,
    stats,
    recent,
    trend: serious.slice(-10).map(examAccuracy),
    racha: { days: dias, playedToday: jugoHoy, best, level: lastRacha ? NIVEL_JUEGO[lastRacha.level].nombre : null, last14 },
    week: { exams: thisWeek.length, seconds: thisWeek.reduce((n, e) => n + e.timeSpentSeconds, 0), byType },
    todayExams: list.filter((e) => toISODate(new Date(e.completedAt)) === todayIso),
  };
}

/* ─────────────────────────── Vista principal ─────────────────────────── */

/**
 * Panel del tutor con plan: resumen de la familia, selector de estudiantes y la ficha de monitoreo de cada uno
 * (metas, planes, racha diaria, exámenes libres y materias). Estadísticas queda para los reportes.
 */
export function StudentMonitor() {
  const { panel } = useTutor();
  const students = panel!.students;
  const [filter, setFilter] = React.useState<GroupFilter>("all");
  const activeFilter = typeof filter === "number" && !panel!.groups.some((g) => g.id === filter) ? "all" : filter;
  const visible = students.filter((s) =>
    activeFilter === "all" ? true : activeFilter === "none" ? s.groupId === null : s.groupId === activeFilter
  );

  const ids = students.map((s) => s.id).join(",");
  const [exams, setExams] = React.useState<TutorExam[] | "error" | null>(null);
  React.useEffect(() => {
    let active = true;
    setExams(null);
    getTutorExams(ids ? ids.split(",") : [])
      .then((data) => active && setExams(data))
      .catch(() => active && setExams("error"));
    return () => {
      active = false;
    };
  }, [ids]);

  const insights = React.useMemo(() => {
    if (!Array.isArray(exams)) return null;
    const map = new Map<string, Insight>();
    for (const s of students) {
      map.set(s.id, buildInsight(exams.filter((e) => e.studentId === s.id)));
    }
    return map;
  }, [exams, students]);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = visible.find((s) => s.id === selectedId) ?? visible[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <FamilyBar insights={insights} />

      <section {...moduleProps("estudiantes", "Estudiantes")} aria-labelledby="students-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="students-title" className="text-lg font-bold">
              {students.length === 1 ? "Tu estudiante" : "Tus estudiantes"}
            </h2>
            <p className="text-sm text-muted-foreground">Elige a quién quieres ver: todo su entrenamiento, en una sola vista.</p>
          </div>
        </div>
        <GroupChips value={activeFilter} onChange={setFilter} />
        {students.length === 0 ? (
          <EmptyStudents />
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No hay estudiantes en este grupo.</p>
        ) : (
          <StudentSwitcher students={visible} insights={insights} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        )}
      </section>

      {exams === "error" && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" /> No pudimos cargar sus exámenes. Recarga la página.
        </p>
      )}

      {selected &&
        (insights ? (
          <StudentProfile key={selected.id} student={selected} insight={insights.get(selected.id)!} />
        ) : (
          exams !== "error" && (
            <div className="grid min-h-60 place-items-center" role="status" aria-label="Cargando su entrenamiento">
              <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
            </div>
          )
        ))}
    </div>
  );
}

function EmptyStudents() {
  const { kind } = useTutor();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-primary/15 text-brand-light">
        <UserPlus className="size-6" aria-hidden />
      </span>
      <h3 className="text-lg font-bold">Aún no hay estudiantes vinculados</h3>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Comparte tu enlace con {TUTOR_COPY[kind].students}. Aparecerán aquí en cuanto se registren.
      </p>
      <InviteButton />
    </div>
  );
}

/* ─────────────────────────── Resumen de la familia ─────────────────────────── */

function FamilyBar({ insights }: { insights: Map<string, Insight> | null }) {
  const { kind, panel } = useTutor();
  const license = panel!.license!;
  const ratio = Math.min(license.used / license.seats, 1);
  const all = insights ? [...insights.values()] : [];
  const weekExams = all.reduce((n, i) => n + i.week.exams, 0);
  const weekSeconds = all.reduce((n, i) => n + i.week.seconds, 0);
  const recents = all.map((i) => i.recent).filter((n): n is number => n !== null);
  const avg = recents.length ? Math.round(recents.reduce((a, b) => a + b, 0) / recents.length) : null;
  const bestStreak = panel!.students
    .map((s) => ({ s, days: insights?.get(s.id)?.racha.days ?? 0 }))
    .sort((a, b) => b.days - a.days)[0];

  return (
    <section
      {...moduleProps("resumen", "Resumen")}
      aria-labelledby="family-title"
      className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-6"
    >
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-secondary/10 blur-3xl" />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {planName(kind, license)}
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] text-success normal-case">
              <span className="size-1.5 rounded-full bg-success" aria-hidden /> Activo
            </span>
            <span className="font-normal normal-case">
              · {license.autoRenew ? "Se renueva" : "Vence"} el {formatDate(license.expiresAt)}
            </span>
          </p>
          <h2 id="family-title" className="text-lg font-bold sm:text-xl">
            Tienes <span className="tabular-nums">{license.used}</span> de <span className="tabular-nums">{license.seats}</span>{" "}
            estudiantes activos
          </h2>
          <div
            role="meter"
            aria-label="Cupos utilizados"
            aria-valuemin={0}
            aria-valuemax={license.seats}
            aria-valuenow={license.used}
            className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-brand-gradient transition-[width]" style={{ width: `${ratio * 100}%` }} />
          </div>
        </div>
        <AddStudentAction />
      </div>

      <dl className="relative mt-5 grid grid-cols-2 gap-2 border-t pt-5 sm:grid-cols-4">
        <FamilyStat icon={NotebookPen} label="Exámenes esta semana" value={insights ? String(weekExams) : "…"} />
        <FamilyStat icon={Target} label="Promedio reciente" value={avg === null ? "—" : `${avg}%`} />
        <FamilyStat icon={Clock} label="Práctica esta semana" value={insights ? formatHours(weekSeconds / 3600) : "…"} />
        <FamilyStat
          icon={Flame}
          label="Mejor racha activa"
          value={bestStreak && bestStreak.days > 0 ? `${bestStreak.days} días` : "—"}
          hint={bestStreak && bestStreak.days > 0 ? bestStreak.s.alias : undefined}
          flame
        />
      </dl>
    </section>
  );
}

function FamilyStat({
  icon: Icon,
  label,
  value,
  hint,
  flame,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  hint?: string;
  flame?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
      <Icon className={cn("size-5 shrink-0", flame ? "text-energy" : "text-brand-light")} aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs leading-tight text-muted-foreground">{label}</dt>
        <dd className="font-bold tabular-nums">
          {value}
          {hint && <span className="block truncate text-xs font-normal text-muted-foreground sm:ml-1 sm:inline">{hint}</span>}
        </dd>
      </div>
    </div>
  );
}

/** Con lugar libre: invitar. Plan lleno: agregar un estudiante más por lo que cuesta de diferencia. */
function useCanAddStudent() {
  const { kind, panel } = useTutor();
  const hasRoom = panel!.students.length < studentLimit(panel!);
  return { hasRoom, offer: hasRoom ? null : (upgradeOffers(kind, panel!.license)[0] ?? null) };
}

function AddStudentAction({ compact }: { compact?: boolean }) {
  const { hasRoom, offer } = useCanAddStudent();
  if (hasRoom) return <InviteButton />;
  if (!offer) return null;
  return (
    <Link
      href="/app/dashboard/billing"
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-secondary/40 bg-secondary/10 px-4 py-3 transition-colors hover:bg-secondary/15 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        compact && "h-full flex-col justify-center text-center"
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow-secondary">
        <UserPlus className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 text-sm">
        <span className="block font-bold">Agrega un estudiante más</span>
        <span className="block text-cool">
          por solo <strong className="text-secondary tabular-nums">{formatMxn(offer.extra)}</strong> más al mes ·{" "}
          {offer.choice.plan.name}
        </span>
      </span>
      {!compact && <ArrowRight className="size-4 shrink-0 text-secondary transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </Link>
  );
}

/* ─────────────────────────── Selector de estudiantes ─────────────────────────── */

function StudentSwitcher({
  students,
  insights,
  selectedId,
  onSelect,
}: {
  students: TutorStudent[];
  insights: Map<string, Insight> | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { hasRoom, offer } = useCanAddStudent();
  return (
    <ul className="grid auto-cols-[minmax(15.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1 [scrollbar-width:thin] sm:auto-cols-[minmax(17rem,20rem)]">
      {students.map((s) => {
        const i = insights?.get(s.id);
        const active = s.id === selectedId;
        const estado = i?.recent != null ? TONE[toneOf(i.recent)] : null;
        const trainedToday = (i?.todayExams.length ?? 0) > 0;
        return (
          <li key={s.id} className={cn("rounded-2xl p-px", active ? "bg-[linear-gradient(135deg,var(--secondary),var(--primary))]" : "bg-border")}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(s.id)}
              className={cn(
                "flex h-full w-full flex-col gap-3 rounded-[calc(1rem-1px)] p-4 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                active ? "bg-card" : "bg-card/70 hover:bg-card"
              )}
            >
              <span className="flex items-center gap-3">
                <ScoreRing value={i?.recent ?? null} color={estado?.fill}>
                  <Avatar name={s.fullName || s.alias} size="sm" />
                </ScoreRing>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{s.alias}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.career ? `${s.career} · ${s.university ?? ""}` : "Sin carrera elegida"}
                  </span>
                </span>
              </span>
              <span className="grid grid-cols-3 gap-1.5 text-center">
                <MiniStat label="Promedio" value={i?.recent != null ? `${i.recent}%` : "—"} tone={estado?.text} />
                <MiniStat
                  label="Racha"
                  value={
                    i ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Flame className={cn("size-3.5", i.racha.days > 0 ? "text-energy" : "text-muted-foreground")} aria-hidden />
                        {i.racha.days}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <MiniStat label="Semana" value={i ? String(i.week.exams) : "—"} />
              </span>
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  trainedToday ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                )}
              >
                <span className={cn("size-1.5 rounded-full", trainedToday ? "bg-success" : "bg-muted-foreground")} aria-hidden />
                {trainedToday ? "Hoy ya entrenó" : "Hoy aún no entrena"}
              </span>
            </button>
          </li>
        );
      })}
      {(hasRoom || offer) && (
        <li className="rounded-2xl border border-dashed">
          <div className="flex h-full min-h-40 items-center justify-center p-3">
            <AddStudentAction compact />
          </div>
        </li>
      )}
    </ul>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <span className="rounded-lg bg-muted/50 px-1.5 py-1.5">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <span className={cn("block text-sm font-bold tabular-nums", tone)}>{value}</span>
    </span>
  );
}

/** Anillo de avance (promedio reciente) alrededor del avatar. */
function ScoreRing({ value, color, children }: { value: number | null; color?: string; children: React.ReactNode }) {
  const r = 23;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-13 shrink-0 place-items-center">
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--muted)" strokeWidth="3" />
        {value !== null && (
          <circle
            cx="26"
            cy="26"
            r={r}
            fill="none"
            stroke={color ?? "var(--secondary)"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(c * value) / 100} ${c}`}
          />
        )}
      </svg>
      {children}
    </span>
  );
}

/* ─────────────────────────── Ficha de monitoreo ─────────────────────────── */

/** Planes activos del estudiante (null = cargando). */
function useStudentPlans(studentId: string) {
  const [plans, setPlans] = React.useState<StudentPlan[] | "error" | null>(null);
  const load = React.useCallback(() => {
    getStudentPlans(studentId)
      .then(setPlans)
      .catch(() => setPlans("error"));
  }, [studentId]);
  React.useEffect(load, [load]);
  return { plans: Array.isArray(plans) ? plans : [], loading: plans === null, failed: plans === "error", reload: load };
}

function StudentProfile({ student, insight }: { student: TutorStudent; insight: Insight }) {
  const { kind } = useTutor();
  const goals = student.goals;
  const { plans, loading: plansLoading, failed: plansFailed, reload: reloadPlans } = useStudentPlans(student.id);
  const [addGoal, setAddGoal] = React.useState(false);
  const [newPlan, setNewPlan] = React.useState(false);
  const [openExam, setOpenExam] = React.useState<TutorExam | null>(null);
  const name = student.fullName || student.alias;
  const main = goals[0] ?? null;
  const today = todayISO();
  const nextExam = plans.filter((p) => p.officialDate > today).sort((a, b) => a.officialDate.localeCompare(b.officialDate))[0];

  return (
    <article {...moduleProps("ficha", "Metas")} aria-label={`Entrenamiento de ${student.alias}`} className="overflow-hidden rounded-3xl border bg-card">
      {/* Quién es y a qué aspira: lo más importante. */}
      <header className="relative flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-secondary uppercase">Tu {TUTOR_COPY[kind].student}</p>
            <h3 className="font-display text-2xl leading-tight font-bold text-balance sm:text-3xl">{name}</h3>
            <p className="mt-1 text-base text-cool text-pretty sm:text-lg">
              {main ? (
                <>
                  Aspirante a <strong className="text-foreground">{main.career}</strong> en {articleFor(main.university)}{" "}
                  <strong className="text-foreground">{main.university}</strong>
                </>
              ) : (
                "Aún no elige carrera"
              )}
            </p>
            <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label="Sus metas">
              {goals.map((g) => (
                <li key={g.careerId} className="flex items-center gap-2 rounded-full border bg-background/40 py-1 pr-3 pl-1 text-xs">
                  <UniversityBadge id={g.universityId} label={g.university} size="sm" className="h-6 min-w-9 rounded-full text-[10px]" />
                  <span className="max-w-48 truncate font-medium">{g.career}</span>
                  {g.main && <Star className="size-3 fill-gold text-gold" aria-label="Meta principal" />}
                </li>
              ))}
              <li>
                <Button variant="outline" size="sm" className="h-8 rounded-full border-dashed" onClick={() => setAddGoal(true)}>
                  <Plus /> Agregar otra carrera/escuela
                </Button>
              </li>
            </ul>
          </div>
        </div>

        <div className="relative flex shrink-0 items-center gap-4 rounded-2xl border border-white/10 bg-background/40 p-4 backdrop-blur-sm lg:w-64 lg:flex-col lg:items-start">
          {nextExam ? (
            <>
              <span className="font-display text-5xl leading-none font-bold text-secondary tabular-nums">
                {daysBetween(today, nextExam.officialDate)}
              </span>
              <span className="text-sm text-cool text-pretty">
                días para su examen <strong className="text-foreground">{nextExam.universityKey}</strong>
                <span className="block text-xs text-muted-foreground">{formatFull(nextExam.officialDate)}</span>
              </span>
            </>
          ) : (
            <>
              <CalendarClock className="size-8 shrink-0 text-brand-light" aria-hidden />
              <span className="text-sm text-cool">
                Sin fecha de examen.{" "}
                <button type="button" className="font-semibold text-brand-light underline-offset-4 hover:underline" onClick={() => setNewPlan(true)}>
                  Programa su plan
                </button>
              </span>
            </>
          )}
        </div>
      </header>

      {/* Pulso: promedio reciente, racha, semana y práctica. */}
      <dl className="grid grid-cols-2 gap-px border-t bg-border lg:grid-cols-4">
        <Kpi label="Promedio (últimos 3)" icon={Target}>
          {insight.recent === null ? (
            <span className="text-2xl font-bold">—</span>
          ) : (
            <div className="flex items-end justify-between gap-2">
              <span className={cn("font-display text-3xl font-bold tabular-nums", TONE[toneOf(insight.recent)].text)}>
                {insight.recent}%
              </span>
              <Sparkline values={insight.trend} color={TONE[toneOf(insight.recent)].fill} />
            </div>
          )}
          {insight.recent !== null && <span className="text-xs text-muted-foreground">{TONE[toneOf(insight.recent)].label}</span>}
        </Kpi>
        <Kpi label="Racha diaria" icon={Flame} flame>
          <span className="font-display text-3xl font-bold tabular-nums">
            {insight.racha.days} <span className="text-base font-medium text-muted-foreground">{insight.racha.days === 1 ? "día" : "días"}</span>
          </span>
          <span className="text-xs text-muted-foreground">{insight.racha.playedToday ? "Hoy ya jugó 🔥" : "Hoy aún no juega"}</span>
        </Kpi>
        <Kpi label="Exámenes esta semana" icon={NotebookPen}>
          <span className="font-display text-3xl font-bold tabular-nums">{insight.week.exams}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            Plan {insight.week.byType.plan} · Libre {insight.week.byType.libre} · Racha {insight.week.byType.racha}
          </span>
        </Kpi>
        <Kpi label="Práctica esta semana" icon={Clock}>
          <span className="font-display text-3xl font-bold tabular-nums">{formatHours(insight.week.seconds / 3600)}</span>
          <span className="text-xs text-muted-foreground">{formatHours(insight.stats.hours)} en total</span>
        </Kpi>
      </dl>

      <div className="flex flex-col gap-5 border-t p-5 sm:p-7">
        <div className="grid gap-3 md:grid-cols-2">
          <TodayCard student={student} insight={insight} plans={plans} />
          {insight.recent !== null ? (
            <PerformanceAlert alias={student.alias} accuracy={insight.recent} />
          ) : (
            <p className="flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
              <Sparkles className="size-5 shrink-0 text-brand-light" aria-hidden /> Cuando termine su primer examen verás aquí cómo va.
            </p>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Panel
            module={["planes", "Planes de estudio"]}
            className="lg:col-span-2"
            icon={CalendarClock}
            title="Planes de estudio"
            action={
              <Button variant="brand" size="sm" onClick={() => setNewPlan(true)} disabled={goals.length === 0}>
                <CalendarPlus /> Crear nuevo plan
              </Button>
            }
          >
            {plansLoading ? (
              <div className="grid min-h-32 place-items-center" role="status" aria-label="Cargando planes">
                <Loader2 className="size-5 animate-spin text-brand-light motion-reduce:animate-none" />
              </div>
            ) : plansFailed ? (
              <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
                <CircleAlert className="size-4 shrink-0" /> No pudimos cargar sus planes.
              </p>
            ) : plans.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center">
                <p className="font-semibold">{student.alias} aún no tiene plan de estudio</p>
                <p className="max-w-sm text-sm text-muted-foreground text-pretty">
                  Elige la fecha de su examen y los días de práctica: le armamos su calendario y aquí ves si cumple.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {plans.map((p) => (
                  <PlanPreview key={p.id} plan={p} />
                ))}
              </ul>
            )}
          </Panel>

          <RachaPanel insight={insight} />

          <LibrePanel className="lg:col-span-2" insight={insight} onOpen={setOpenExam} />

          <MateriasPanel insight={insight} />
        </div>
      </div>

      <footer className="flex flex-col gap-3 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-7">
        <div className="w-full sm:w-56">
          <GroupSelect studentId={student.id} groupId={student.groupId} label={`Grupo de ${student.alias}`} />
        </div>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/dashboard/analytics?alumno=${student.id}`}>
              <BarChart3 /> Reporte completo
            </Link>
          </Button>
          <SeatActions student={student} />
        </div>
      </footer>

      <AddGoalDialog student={student} goals={goals} open={addGoal} onOpenChange={setAddGoal} />
      <CreatePlanDialog student={student} goals={goals} open={newPlan} onOpenChange={setNewPlan} onCreated={reloadPlans} />
      <ExamResultsDialog exam={openExam} onOpenChange={(o) => !o && setOpenExam(null)} />
    </article>
  );
}

function Kpi({ label, icon: Icon, flame, children }: { label: string; icon: typeof Flame; flame?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 bg-card p-4 sm:px-6">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className={cn("size-3.5", flame ? "text-energy" : "text-brand-light")} aria-hidden /> {label}
      </dt>
      <dd className="flex flex-col gap-0.5">{children}</dd>
    </div>
  );
}

/** Mini gráfica de los últimos exámenes (sin ejes: la tendencia, no los valores). */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 88;
  const h = 32;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 2 - (v / 100) * (h - 4)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0" role="img" aria-label={`Últimos ${values.length} exámenes: ${values.join("%, ")}%`}>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} stroke="var(--card)" strokeWidth="2" />
    </svg>
  );
}

function Panel({
  title,
  icon: Icon,
  action,
  className,
  module,
  children,
}: {
  module?: [id: string, label: string];
  title: string;
  icon: typeof Flame;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section {...(module ? moduleProps(...module) : {})} className={cn("flex min-w-0 flex-col gap-4 rounded-2xl border bg-background/30 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-bold">
          <Icon className="size-5 text-brand-light" aria-hidden /> {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Qué pasa hoy: examen del plan pendiente, lo que ya entrenó o descanso. */
function TodayCard({ student, insight, plans }: { student: TutorStudent; insight: Insight; plans: StudentPlan[] }) {
  const today = todayISO();
  const due = plans.flatMap((p) => dueSessions(p, today).map((s) => ({ s, p })));
  const dueToday = due.filter((d) => d.s.date === today);
  const late = due.length - dueToday.length;
  const done = insight.todayExams;

  if (done.length > 0) {
    const byType = done.reduce<Record<string, number>>((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {});
    const label = Object.entries(byType)
      .map(([t, n]) => `${n} ${t === "racha" ? "racha" : t === "plan" ? "de plan" : "libre"}`)
      .join(" · ");
    return (
      <div className="flex gap-3 rounded-xl border border-success/40 bg-success/10 p-3 text-sm">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div className="min-w-0">
          <p className="font-bold">Hoy ya entrenó</p>
          <p className="text-cool">
            {label}
            {dueToday.length > 0 && ` · le falta su examen del plan (${formatWindow(dueToday[0].p.timeWindow)})`}
          </p>
        </div>
      </div>
    );
  }
  if (dueToday.length > 0 || late > 0) {
    return (
      <div className="flex gap-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">
        <NotebookPen className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
        <div className="min-w-0">
          <p className="font-bold">
            {dueToday.length > 0 ? `Hoy le toca su examen del plan` : `Tiene ${late} examen${late > 1 ? "es" : ""} atrasado${late > 1 ? "s" : ""}`}
          </p>
          <p className="text-cool">
            {dueToday.length > 0 ? `Horario: ${formatWindow(dueToday[0].p.timeWindow)}.` : ""} Un mensaje tuyo hace la diferencia.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
      <Coffee className="mt-0.5 size-5 shrink-0 text-brand-light" aria-hidden />
      <div className="min-w-0">
        <p className="font-bold">Hoy {student.alias} descansa</p>
        <p className="text-cool">No tiene examen del plan hoy. Una racha rápida mantiene el ritmo.</p>
      </div>
    </div>
  );
}

function PlanPreview({ plan }: { plan: StudentPlan }) {
  const today = todayISO();
  const done = completedSessions(plan).length;
  const total = plan.sessions.length;
  const past = plan.sessions.filter((s) => s.date < today).length;
  const compliance = past ? Math.round((100 * plan.sessions.filter((s) => s.date < today && s.exam).length) / past) : null;
  const recent = recentAverage(plan);
  const recentTone = recent ? TONE[toneOf(recent.avg)] : null;
  const left = daysBetween(today, plan.officialDate);
  const days = DIAS.filter((d) => plan.practiceDays.includes(d.key))
    .map((d) => d.abrev)
    .join(", ");

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <UniversityBadge id={plan.universityKey.toLowerCase()} label={plan.universityKey} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{plan.careerName}</span>
            <span className="block text-xs text-muted-foreground">
              Examen: {formatFull(plan.officialDate)} · {days} · {formatWindow(plan.timeWindow)}
            </span>
          </span>
        </span>
        {left > 0 ? (
          <span className="shrink-0 text-right">
            <span className="block font-display text-2xl leading-none font-bold text-secondary tabular-nums">{left}</span>
            <span className="text-[10px] text-muted-foreground">{left === 1 ? "día" : "días"}</span>
          </span>
        ) : (
          <Trophy className="size-6 shrink-0 text-gold" aria-label="Llegó su examen" />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap justify-between gap-x-3 text-xs">
          <span className="text-muted-foreground tabular-nums">
            Presentados {done} de {total}
            {compliance !== null && (
              <>
                {" "}
                · cumplimiento <strong className={compliance >= 80 ? "text-success" : "text-gold"}>{compliance}%</strong>
              </>
            )}
          </span>
          {recent && recentTone && (
            <span className={cn("font-semibold", recentTone.text)}>
              Últimos {recent.exams.length}: {recent.avg}% · {recentTone.label}
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${total ? (100 * done) / total : 0}%` }} />
        </div>
      </div>

      <PlanWeekStrip plan={plan} />
    </li>
  );
}

function RachaPanel({ insight }: { insight: Insight }) {
  const { racha } = insight;
  const today = todayISO();
  return (
    <Panel module={["racha", "Racha diaria"]} icon={Flame} title="Racha diaria">
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "grid size-16 shrink-0 place-items-center rounded-2xl",
            racha.days > 0 ? "bg-energy/15 text-energy shadow-glow-energy" : "bg-muted text-muted-foreground"
          )}
        >
          <Flame className="size-8" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-display text-3xl leading-none font-bold tabular-nums">
            {racha.days} <span className="text-base font-medium text-muted-foreground">{racha.days === 1 ? "día seguido" : "días seguidos"}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mejor racha: {racha.best} {racha.best === 1 ? "día" : "días"}
            {racha.level && ` · nivel ${racha.level}`}
          </p>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Últimos 14 días</p>
        <ol className="grid grid-cols-7 gap-1.5" aria-label="Días con racha en las últimas dos semanas">
          {racha.last14.map((d) => (
            <li
              key={d.date}
              title={d.date}
              aria-label={`${d.date}: ${d.played ? "jugó" : "no jugó"}`}
              className={cn(
                "grid aspect-square place-items-center rounded-md",
                d.played ? "bg-energy/80 text-white" : "bg-muted/60",
                d.date === today && "ring-2 ring-foreground/60"
              )}
            >
              {d.played && <Flame className="size-3" aria-hidden />}
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

function LibrePanel({ insight, onOpen, className }: { insight: Insight; onOpen: (e: TutorExam) => void; className?: string }) {
  const libres = insight.list.filter((e) => e.type === "libre").reverse();
  const shown = libres.slice(0, 5);
  return (
    <Panel
      module={["libres", "Exámenes libres"]}
      className={className}
      icon={BookOpen}
      title="Exámenes libres"
      action={libres.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{libres.length} en total</span>}
    >
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no presenta exámenes libres. Son simulacros completos, como el día del examen.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((e) => {
            const pct = examAccuracy(e);
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-3 py-2.5">
                <UniversityBadge id={e.universityKey.toLowerCase()} label={e.universityKey} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{e.careerName}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {shortDate(e.completedAt)} · {e.totalQuestions} preguntas · <strong className="text-foreground">{wrongOf(e)}</strong> mal
                    contestadas
                  </span>
                </span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums", TONE[toneOf(pct)].bg, TONE[toneOf(pct)].text)}>
                  {pct}%
                </span>
                <Button variant="ghost" size="sm" className="text-brand-light" onClick={() => onOpen(e)}>
                  <BarChart3 /> Ver resultados
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** Materias de menor a mayor: arriba lo que hay que reforzar. */
function MateriasPanel({ insight }: { insight: Insight }) {
  const rows = [...insight.stats.materias].sort((a, b) => a.overall - b.overall);
  return (
    <Panel module={["materias", "Materias"]} icon={GraduationCap} title="Materias">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aparecerán con su primer examen.</p>
      ) : (
        <>
          {insight.stats.weakest && (
            <p className="rounded-lg bg-energy/10 px-3 py-2 text-xs text-cool">
              <strong className="text-foreground">A reforzar:</strong> {insight.stats.weakest.materia} ({insight.stats.weakest.overall}%)
              {insight.stats.strongest && (
                <>
                  {" "}
                  · <strong className="text-foreground">Su fuerte:</strong> {insight.stats.strongest.materia}
                </>
              )}
            </p>
          )}
          <ul className="flex flex-col gap-2.5">
            {rows.slice(0, 7).map((m) => (
              <li key={m.materia} className="flex flex-col gap-1 text-sm">
                <span className="flex justify-between gap-2">
                  <span className="truncate">{m.materia}</span>
                  <span className="font-semibold tabular-nums">{m.overall}%</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className={cn("block h-full rounded-full", TONE[toneOf(m.overall)].bar)} style={{ width: `${m.overall}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/* ─────────────────────────── Gestión del cupo ─────────────────────────── */

function SeatActions({ student }: { student: TutorStudent }) {
  const { panel, reload } = useTutor();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const canActivate = !student.active && !!panel!.license?.active;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
      setConfirm(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {student.active ? (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => releaseSeat(student.id))}>
          {busy ? <Loader2 className="animate-spin" /> : <PowerOff />} Liberar cupo
        </Button>
      ) : (
        canActivate && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => activateSeat(student.id))}>
            {busy ? <Loader2 className="animate-spin" /> : <Power />} Activar
          </Button>
        )
      )}
      <Button variant="ghost" size="sm" className="hover:text-destructive" onClick={() => setConfirm(true)}>
        <UserMinus /> Quitar
      </Button>
      {error && !confirm && (
        <p role="alert" className="flex w-full items-center gap-1.5 text-xs text-destructive">
          <CircleAlert className="size-3.5 shrink-0" /> {error}
        </p>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Quitar a {student.alias} de tu panel?</DialogTitle>
            <DialogDescription>
              Se libera su cupo y dejarás de ver sus estadísticas. Su cuenta y su historial de exámenes no se borran.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <CircleAlert className="size-4 shrink-0" /> {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button className="bg-destructive hover:bg-destructive/90" disabled={busy} onClick={() => run(() => unlinkStudent(student.id))}>
              {busy && <Loader2 className="animate-spin" />} Quitar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
