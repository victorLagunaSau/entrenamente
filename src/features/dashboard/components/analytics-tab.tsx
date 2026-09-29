"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  FileDown,
  Flame,
  Grid3x3,
  Loader2,
  MessageCircle,
  NotebookPen,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

import { computeStats, EXAM_TYPES, formatHours, whatsappSummary, type TutorStats } from "../lib/tutor-stats";
import { getTutorExams, type ExamType, type TutorExam, type TutorStudent } from "../services/tutor-service";
import { MateriaHeatmap, WeeklyScoreChart } from "./charts";
import { ActivateWithPlan, TrialMeter } from "./student-trial";
import { TutorReport } from "./tutor-report";
import { useTutor } from "./tutor-context";
import { InactiveWall } from "./tutor-dashboard";

/** Quién se está analizando: todos, un grupo o un estudiante (se guarda en la URL para compartir el enlace). */
export type Subject = { kind: "all" } | { kind: "group"; id: number } | { kind: "student"; id: string };

export type SubjectInfo = { label: string; students: TutorStudent[]; single: boolean };

const MODE_ICON: Record<ExamType, typeof Flame> = { plan: CalendarCheck, libre: NotebookPen, racha: Flame };

export function AnalyticsTab() {
  const { panel, lapsed } = useTutor();
  if (lapsed) return <InactiveWall />;
  if (panel!.students.length === 0) {
    return (
      <Empty icon={Users} title="Aún no hay estudiantes vinculados">
        Invita a tus estudiantes desde la pestaña{" "}
        <Link href="/app/dashboard" className="text-brand-light underline-offset-4 hover:underline">
          Estudiantes
        </Link>{" "}
        para ver aquí su rendimiento.
      </Empty>
    );
  }
  return <Analytics />;
}

function useSubject(): [Subject, (s: Subject) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const alumno = params.get("alumno");
  const grupo = params.get("grupo");
  const subject: Subject = alumno
    ? { kind: "student", id: alumno }
    : grupo && Number.isFinite(Number(grupo))
      ? { kind: "group", id: Number(grupo) }
      : { kind: "all" };

  const set = (s: Subject) => {
    const q = s.kind === "student" ? `?alumno=${s.id}` : s.kind === "group" ? `?grupo=${s.id}` : "";
    router.replace(`${pathname}${q}`, { scroll: false });
  };
  return [subject, set];
}

function Analytics() {
  const { kind, panel } = useTutor();
  const { students, groups } = panel!;
  const [subject, setSubject] = useSubject();

  const info = React.useMemo<SubjectInfo>(() => {
    if (subject.kind === "student") {
      const s = students.find((x) => x.id === subject.id);
      if (s) return { label: s.alias, students: [s], single: true };
    }
    if (subject.kind === "group") {
      const g = groups.find((x) => x.id === subject.id);
      if (g) return { label: g.name, students: students.filter((s) => s.groupId === g.id), single: false };
    }
    return {
      label: kind === "parent" ? "Todos mis estudiantes" : "Todos mis alumnos",
      students,
      single: students.length === 1,
    };
  }, [subject, students, groups, kind]);

  const ids = React.useMemo(() => info.students.map((s) => s.id), [info.students]);
  const key = ids.join(",");
  const [exams, setExams] = React.useState<{ key: string; data: TutorExam[] } | "error" | undefined>(undefined);

  React.useEffect(() => {
    let active = true;
    getTutorExams(ids)
      .then((data) => active && setExams({ key, data }))
      .catch(() => active && setExams("error"));
    return () => {
      active = false;
    };
    // `key` resume los ids: evita recargar cuando solo cambia la identidad del arreglo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ready = exams && exams !== "error" && exams.key === key ? exams.data : null;
  const stats = React.useMemo(() => (ready ? computeStats(ready) : null), [ready]);

  return (
    <div className="flex flex-col gap-6">
      <SubjectPicker subject={subject} onChange={setSubject} />

      {exams === "error" ? (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" /> No pudimos cargar las estadísticas. Recarga la página.
        </p>
      ) : !stats || !ready ? (
        <div className="grid min-h-60 place-items-center" role="status" aria-label="Cargando estadísticas">
          <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
        </div>
      ) : info.students.length === 0 ? (
        <Empty icon={Users} title="Este grupo no tiene estudiantes">
          Asígnales el grupo desde la pestaña Estudiantes.
        </Empty>
      ) : (
        <>
          {!panel!.license && <TrialBanner info={info} />}
          <ExportBar info={info} stats={stats} exams={ready} />
          {stats.exams === 0 ? (
            <Empty icon={BarChart3} title="Aún no hay exámenes">
              {info.single ? `${info.label} todavía` : "Todavía nadie"} no ha terminado un examen. Las estadísticas aparecerán
              aquí en cuanto lo haga{info.single ? "" : "n"}.
            </Empty>
          ) : (
            <Dashboard info={info} stats={stats} exams={ready} />
          )}
        </>
      )}
    </div>
  );
}

function SubjectPicker({ subject, onChange }: { subject: Subject; onChange: (s: Subject) => void }) {
  const { panel } = useTutor();
  const { students, groups } = panel!;
  const value = subject.kind === "all" ? "all" : `${subject.kind}:${subject.id}`;

  const change = (v: string) => {
    if (v === "all") return onChange({ kind: "all" });
    const [k, id] = v.split(":");
    onChange(k === "group" ? { kind: "group", id: Number(id) } : { kind: "student", id });
  };

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor="analytics-subject" className="text-sm font-medium text-cool">
        Ver métricas de
      </label>
      <div className="relative sm:w-80">
        <select
          id="analytics-subject"
          value={value}
          onChange={(e) => change(e.target.value)}
          className="h-11 w-full appearance-none rounded-md border border-input bg-background/60 pr-9 pl-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <option value="all">Todos ({students.length})</option>
          {groups.length > 0 && (
            <optgroup label="Grupo completo">
              {groups.map((g) => (
                <option key={g.id} value={`group:${g.id}`}>
                  {g.name} ({students.filter((s) => s.groupId === g.id).length})
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Estudiante individual">
            {students.map((s) => (
              <option key={s.id} value={`student:${s.id}`}>
                {s.alias}
              </option>
            ))}
          </optgroup>
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

/** Padre sin plan: está viendo la prueba gratuita; el contador es el del estudiante (desde su registro). */
function TrialBanner({ info }: { info: SubjectInfo }) {
  const student = info.single ? info.students[0] : null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm text-cool text-pretty">
          <strong className="text-gold">Estás viendo la prueba gratuita.</strong> Activa tu plan para que{" "}
          {student ? student.alias : "tus estudiantes"} siga{student ? "" : "n"} entrenando sin límites y descargues sus
          reportes en PDF.
        </p>
        {student && <TrialMeter student={student} compact />}
      </div>
      <Button asChild variant="brand" className="shrink-0">
        <Link href="/app/dashboard/billing">
          <Sparkles /> Activa tu plan
        </Link>
      </Button>
    </section>
  );
}

function ExportBar({ info, stats, exams }: { info: SubjectInfo; stats: TutorStats; exams: TutorExam[] }) {
  const { panel } = useTutor();
  const [copied, setCopied] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappSummary(info.label, stats, BRAND.name));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  // El reporte se monta solo para imprimir; "Guardar como PDF" en el diálogo del navegador lo descarga.
  React.useEffect(() => {
    if (!printing) return;
    // Deja cargar logo y gráficas; print() bloquea hasta que se cierra el diálogo.
    const t = setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 300);
    return () => clearTimeout(t);
  }, [printing]);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        Reporte de <strong className="text-foreground">{info.label}</strong>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant={copied ? "secondary" : "outline"} onClick={copy} aria-live="polite">
          {copied ? <Check /> : <MessageCircle />} {copied ? "¡Resumen copiado!" : "Copiar Resumen para WhatsApp"}
        </Button>
        {panel!.license ? (
          <Button variant="default" onClick={() => setPrinting(true)} disabled={printing || stats.exams === 0}>
            {printing ? <Loader2 className="animate-spin" /> : <FileDown />} Descargar Reporte PDF
          </Button>
        ) : (
          <ActivateWithPlan label="Reporte PDF · Activa con tu plan" className="h-10" />
        )}
      </div>
      {printing && <TutorReport info={info} stats={stats} exams={exams} />}
    </div>
  );
}

function Dashboard({ info, stats, exams }: { info: SubjectInfo; stats: TutorStats; exams: TutorExam[] }) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="overview-title" className="flex flex-col gap-3">
        <h2 id="overview-title" className="sr-only">
          Vista general
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Target} label="Promedio global de aciertos" value={`${stats.accuracy ?? 0}%`} tone="brand" />
          <Kpi icon={NotebookPen} label="Exámenes realizados" value={stats.exams.toLocaleString("es-MX")} />
          <Kpi icon={Clock} label="Horas de práctica" value={formatHours(stats.hours)} />
          <Kpi icon={CalendarCheck} label="Exámenes esta semana" value={String(stats.examsThisWeek)} />
        </ul>
        <ul className="grid gap-3 sm:grid-cols-3">
          {stats.byMode.map((m) => {
            const Icon = MODE_ICON[m.type];
            return (
              <li key={m.type} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-lg",
                    m.type === "racha" ? "bg-energy/15 text-energy" : "bg-primary/15 text-brand-light"
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{EXAM_TYPES.find((t) => t.id === m.type)!.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.exams} {m.exams === 1 ? "examen" : "exámenes"}
                  </p>
                </div>
                <p className="text-xl font-bold tabular-nums">{m.accuracy === null ? "—" : `${m.accuracy}%`}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <Card icon={TrendingUp} title="Evolución semanal" subtitle="% de aciertos por semana · últimas 12 semanas">
        <WeeklyScoreChart weeks={stats.weeks} />
      </Card>

      <Card
        icon={Grid3x3}
        title="Mapa de calor por materias"
        subtitle="% de aciertos por materia en cada modalidad"
        aside={
          (stats.strongest || stats.weakest) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {stats.strongest && (
                <span className="rounded-full bg-secondary/15 px-2.5 py-1 text-cool">
                  Más fuerte: <strong className="text-foreground">{stats.strongest.materia}</strong> ({stats.strongest.overall}%)
                </span>
              )}
              {stats.weakest && (
                <span className="rounded-full bg-gold/10 px-2.5 py-1 text-cool">
                  A reforzar: <strong className="text-foreground">{stats.weakest.materia}</strong> ({stats.weakest.overall}%)
                </span>
              )}
            </div>
          )
        }
      >
        <MateriaHeatmap rows={stats.materias} />
      </Card>

      {!info.single && <ByStudent info={info} exams={exams} />}
    </div>
  );
}

/** Comparativa del grupo: una fila por estudiante. */
function ByStudent({ info, exams }: { info: SubjectInfo; exams: TutorExam[] }) {
  const rows = info.students
    .map((s) => {
      const own = exams.filter((e) => e.studentId === s.id);
      const st = computeStats(own);
      return { student: s, stats: st, last: own.at(-1)?.completedAt ?? null };
    })
    .sort((a, b) => (b.stats.accuracy ?? -1) - (a.stats.accuracy ?? -1));

  return (
    <Card icon={Users} title="Por estudiante" subtitle="Ordenados por promedio de aciertos">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">Estudiante</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Aciertos</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Exámenes</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Práctica</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Último examen</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ student, stats, last }) => (
              <tr key={student.id}>
                <td className="py-2.5 pr-3">
                  <Link
                    href={`/app/dashboard/analytics?alumno=${student.id}`}
                    className="font-medium text-brand-light underline-offset-4 hover:underline"
                  >
                    {student.alias}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                  {stats.accuracy === null ? "—" : `${stats.accuracy}%`}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{stats.exams}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{stats.exams ? formatHours(stats.hours) : "—"}</td>
                <td className="py-2.5 pl-3 text-right text-muted-foreground">
                  {last ? new Date(last).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Target; label: string; value: string; tone?: "brand" }) {
  return (
    <li className={cn("flex flex-col gap-2 rounded-xl border bg-card p-4", tone === "brand" && "border-secondary/40")}>
      <Icon className={cn("size-5", tone === "brand" ? "text-secondary" : "text-brand-light")} aria-hidden />
      <p className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </li>
  );
}

function Card({
  icon: Icon,
  title,
  subtitle,
  aside,
  children,
}: {
  icon: typeof Target;
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-brand-light">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Empty({ icon: Icon, title, children }: { icon: typeof Target; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-primary/15 text-brand-light">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">{children}</p>
    </section>
  );
}
