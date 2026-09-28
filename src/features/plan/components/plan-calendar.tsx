"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, CircleAlert, Move, NotebookPen, Play, Repeat, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  addDays,
  DIAS,
  estadoDe,
  ESTADOS,
  formatLong,
  formatShort,
  fromISODate,
  type PlanSession,
  type StudentPlan,
  todayISO,
  toISODate,
  weekdayIndex,
} from "../lib/plan";

type View = "mes" | "semana";

const monthFmt = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });

const startOfWeek = (iso: string) => addDays(iso, -weekdayIndex(iso));
const startOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;
function addMonths(iso: string, n: number) {
  const d = fromISODate(startOfMonth(iso));
  d.setMonth(d.getMonth() + n);
  return toISODate(d);
}

/**
 * Calendario del plan. Pendientes: se arrastran a otro día (computadora) o se tocan y luego se toca el día nuevo
 * (celular / teclado). Solo se puede mover de hoy al día anterior al examen oficial; la base lo vuelve a validar.
 */
export function PlanCalendar({ plan, onMove }: { plan: StudentPlan; onMove: (sessionId: number, date: string) => void }) {
  const today = todayISO();
  const [view, setView] = React.useState<View>("semana");
  const [cursor, setCursor] = React.useState(() => startOfWeek(today));
  const [moving, setMoving] = React.useState<PlanSession | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  const first = plan.sessions[0]?.date ?? today;
  const bounds = { min: first < today ? first : today, max: plan.officialDate };

  const byDate = React.useMemo(() => {
    const map = new Map<string, PlanSession[]>();
    for (const s of plan.sessions) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [plan.sessions]);

  const canDrop = (date: string) => date >= today && date < plan.officialDate;

  // Celdas visibles.
  const cells: string[] = [];
  if (view === "mes") {
    const start = startOfWeek(cursor);
    const end = addDays(startOfWeek(addDays(addMonths(cursor, 1), -1)), 6);
    for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d);
  } else {
    for (let i = 0; i < 7; i++) cells.push(addDays(cursor, i));
  }

  const step = (dir: 1 | -1) => setCursor((c) => (view === "mes" ? addMonths(c, dir) : addDays(c, dir * 7)));
  const prevDisabled = view === "mes" ? cursor <= startOfMonth(bounds.min) : cursor <= startOfWeek(bounds.min);
  const nextDisabled = view === "mes" ? cursor >= startOfMonth(bounds.max) : addDays(cursor, 6) >= bounds.max;

  const switchView = (v: View) => {
    setView(v);
    const anchor = cursor.slice(0, 7) === today.slice(0, 7) ? today : cursor;
    setCursor(v === "mes" ? startOfMonth(anchor) : startOfWeek(anchor));
  };

  const drop = (date: string) => {
    if (moving && canDrop(date) && date !== moving.date) onMove(moving.id, date);
    setMoving(null);
    setDragOver(null);
  };

  React.useEffect(() => {
    if (!moving) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMoving(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [moving]);

  const title =
    view === "mes" ? monthFmt.format(fromISODate(cursor)) : `${formatShort(cursor)} – ${formatShort(addDays(cursor, 6))}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => step(-1)} disabled={prevDisabled} aria-label="Anterior">
            <ChevronLeft />
          </Button>
          <h3 className="min-w-40 text-center font-display font-semibold first-letter:uppercase" aria-live="polite">
            {title}
          </h3>
          <Button variant="ghost" size="icon" onClick={() => step(1)} disabled={nextDisabled} aria-label="Siguiente">
            <ChevronRight />
          </Button>
        </div>
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Vista">
          {(["mes", "semana"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => switchView(v)}
              className="rounded-md px-3 py-1 text-sm font-medium text-muted-foreground capitalize transition-colors aria-pressed:bg-secondary/15 aria-pressed:text-secondary"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {moving && (
        <p className="sticky top-18 z-10 flex items-center gap-2 rounded-xl border border-secondary/40 bg-card p-2.5 pl-3 text-sm shadow-lg" role="status">
          <Move className="size-4 shrink-0 text-secondary" aria-hidden />
          <span className="flex-1">
            Elige el nuevo día para el examen del <strong>{formatLong(moving.date)}</strong>.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setMoving(null)}>
            <X /> Cancelar
          </Button>
        </p>
      )}

      <div className={cn("grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground", view === "semana" ? "hidden sm:grid" : "grid")} aria-hidden>
        {DIAS.map((d) => (
          <span key={d.key}>{d.corto}</span>
        ))}
      </div>
      <div className={cn("grid gap-1", view === "mes" ? "grid-cols-7" : "grid-cols-1 sm:grid-cols-7")} role="grid" aria-label="Calendario del plan">
        {cells.map((date) => {
          const sessions = byDate.get(date) ?? [];
          const outside = view === "mes" && date.slice(0, 7) !== cursor.slice(0, 7);
          const droppable = moving !== null && canDrop(date);
          const official = date === plan.officialDate;
          return (
            <div
              key={date}
              role="gridcell"
              aria-label={`${formatLong(date)}${sessions.length ? `, ${sessions.length} ${sessions.length === 1 ? "examen" : "exámenes"}` : ""}`}
              onClick={() => moving && drop(date)}
              onDragOver={(e) => {
                if (!canDrop(date)) return;
                e.preventDefault();
                setDragOver(date);
              }}
              onDragLeave={() => setDragOver((d) => (d === date ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                drop(date);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-1 transition-colors",
                view === "mes" ? "min-h-16 sm:min-h-20" : "min-h-12 flex-row items-center gap-3 p-2 sm:min-h-40 sm:flex-col sm:items-stretch sm:gap-1 sm:p-1",
                outside ? "border-transparent opacity-40" : "bg-background/40",
                date === today && "border-secondary",
                official && "border-gold bg-gold/10",
                droppable && "cursor-pointer border-dashed border-secondary/60 hover:bg-secondary/10",
                dragOver === date && "bg-secondary/20",
                moving && !droppable && "opacity-40"
              )}
            >
              <span
                className={cn(
                  "text-left text-[11px] font-semibold",
                  date === today ? "text-secondary" : "text-muted-foreground",
                  view === "semana" && "w-20 shrink-0 sm:w-auto"
                )}
              >
                {fromISODate(date).getDate()}
                {view === "semana" && (
                  <span className="ml-1 font-normal">
                    <span className="sm:hidden">{DIAS[weekdayIndex(date)].nombre}</span>
                    <span className="hidden sm:inline">{DIAS[weekdayIndex(date)].nombre.slice(0, 3)}</span>
                  </span>
                )}
              </span>
              {official && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-gold">
                  <Trophy className="size-3.5 shrink-0" aria-hidden /> <span className="hidden sm:inline">Examen oficial</span>
                </span>
              )}
              <div className={cn("flex w-full flex-col gap-0.5", view === "semana" && "gap-1")}>
                {sessions.map((s) => (
                  <SessionChip
                    key={s.id}
                    session={s}
                    today={today}
                    wide={view === "semana"}
                    selected={moving?.id === s.id}
                    onPick={() => setMoving((m) => (m?.id === s.id ? null : s))}
                    onDragStart={() => setMoving(s)}
                    onDragEnd={() => {
                      setDragOver(null);
                      setMoving((m) => (m?.id === s.id ? null : m));
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Legend />
    </div>
  );
}

function SessionChip({
  session: s,
  today,
  wide,
  selected,
  onPick,
  onDragStart,
  onDragEnd,
}: {
  session: PlanSession;
  today: string;
  wide: boolean;
  selected: boolean;
  onPick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  // De lado a lado de la celda. En el mes, en celular solo cabe el ícono.
  const base = cn(
    "flex h-6 w-full min-w-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    wide ? "h-auto min-h-8 justify-start px-2 py-1 text-left text-xs leading-tight" : "justify-center sm:justify-start"
  );
  // Semana: texto completo; mes: corto para que no se corte.
  const label = (full: string, short = full) => <span className={cn(wide ? "min-w-0" : "hidden truncate sm:inline")}>{wide ? full : short}</span>;
  const drag = {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(s.id));
      onDragStart();
    },
    onDragEnd,
  };

  if (s.exam) {
    const estado = ESTADOS[estadoDe(s.exam.score)];
    return (
      <Link
        href={`/app/student/exam/resultado?folio=${encodeURIComponent(s.exam.folio)}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(base, estado.bg, estado.text, "hover:brightness-125")}
        title={`Presentado · ${s.exam.score} % · ver reporte`}
        aria-label={`Examen presentado, ${s.exam.score} %. Ver reporte`}
      >
        <Check className="size-3.5 shrink-0" aria-hidden />
        {label(`${s.exam.score} % · Ver reporte`, `${s.exam.score} %`)}
      </Link>
    );
  }

  const refuerzo = s.kind === "refuerzo";

  // Hoy o atrasado: botón directo al examen (se puede seguir arrastrando para moverlo).
  if (s.date <= today) {
    const overdue = s.date < today;
    const text = overdue ? (refuerzo ? "Refuerzo atrasado" : "Examen atrasado") : refuerzo ? "Refuerzo de examen" : "Examen del día";
    const short = overdue ? "Atrasado" : refuerzo ? "Refuerzo" : "Examen hoy";
    const Icon = overdue ? CircleAlert : refuerzo ? Repeat : Play;
    return (
      <Link
        href={`/app/student/plan/examen?sesion=${s.id}`}
        onClick={(e) => e.stopPropagation()}
        {...drag}
        title={`${text} · presentar ahora`}
        aria-label={`${text}. Presentar ahora`}
        className={cn(
          base,
          "shadow-sm transition-[filter] hover:brightness-110",
          overdue ? "bg-gold text-background" : refuerzo ? "bg-energy text-background" : "bg-brand-gradient text-white"
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label(text, short)}
      </Link>
    );
  }

  const text = refuerzo ? "Refuerzo de examen" : "Examen";
  const Icon = refuerzo ? Repeat : NotebookPen;
  return (
    <button
      type="button"
      {...drag}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      aria-pressed={selected}
      title={`${text} · toca o arrastra para mover`}
      aria-label={`${text} programado. Mover de fecha`}
      className={cn(
        base,
        "cursor-grab active:cursor-grabbing",
        refuerzo ? "bg-energy/15 text-energy" : "bg-primary/20 text-brand-light",
        selected && "ring-2 ring-secondary"
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label(text, refuerzo ? "Refuerzo" : "Examen")}
    </button>
  );
}

function Legend() {
  const items = [
    { icon: Play, cls: "bg-brand-gradient text-white", label: "Examen del día (toca para presentar)" },
    { icon: NotebookPen, cls: "bg-primary/20 text-brand-light", label: "Programado" },
    { icon: Repeat, cls: "bg-energy/15 text-energy", label: "Refuerzo" },
    { icon: CircleAlert, cls: "bg-gold text-background", label: "Atrasado (toca para presentar)" },
    { icon: Check, cls: "bg-secondary/15 text-secondary", label: "Presentado (calificación)" },
    { icon: Trophy, cls: "bg-gold/10 text-gold", label: "Examen oficial" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={cn("grid size-5 place-items-center rounded", i.cls)}>
            <i.icon className="size-3" aria-hidden />
          </span>
          {i.label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <Move className="size-3.5" aria-hidden /> Arrastra un examen para moverlo de día (los programados también se mueven tocándolos)
      </li>
    </ul>
  );
}
