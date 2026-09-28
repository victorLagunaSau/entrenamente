"use client";

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import type { MateriaSummary } from "@/features/exam/lib/libre";
import { cn } from "@/lib/utils";

import { completedSessions, estadoDe, ESTADOS, PLAN_ALTO, PLAN_BAJO, recentAverage, type StudentPlan, ULTIMOS } from "../lib/plan";
import { getMateriasDe } from "../services/plan-service";

const dayFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

/**
 * Estadísticas del plan. Regla de los últimos 3: el promedio, el estatus y el mapa de calor solo cuentan los
 * 3 exámenes más recientes, para que los errores de los primeros días no pesen todo el proceso.
 * La gráfica sí muestra toda la evolución (con los últimos 3 resaltados).
 */
export function PlanStats({ plan }: { plan: StudentPlan }) {
  const recent = recentAverage(plan);
  const done = completedSessions(plan);

  if (!recent) {
    return (
      <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
        Tus estadísticas aparecen al presentar tu primer examen del plan.
      </p>
    );
  }

  const estado = ESTADOS[recent.estado];
  const prev = done.length > ULTIMOS ? done.slice(-ULTIMOS - 1, -1) : null;
  const prevAvg = prev ? Math.round(prev.reduce((n, s) => n + s.exam.score, 0) / prev.length) : null;
  const delta = prevAvg !== null ? recent.avg - prevAvg : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className={cn("flex flex-col gap-3 rounded-2xl border p-5", estado.bg)}>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Promedio de tus últimos {recent.exams.length === 1 ? "examen" : `${recent.exams.length} exámenes`}
        </p>
        <p className="flex items-baseline gap-3">
          <span className={cn("font-display text-5xl font-bold", estado.text)}>{recent.avg}%</span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold", estado.text, estado.bg)}>{estado.nombre}</span>
        </p>
        <ul className="flex gap-2">
          {recent.exams.map((e) => (
            <li key={e.id} className="flex-1 rounded-lg bg-background/50 p-2 text-center">
              <p className={cn("text-lg font-bold", ESTADOS[estadoDe(e.score)].text)}>{e.score}%</p>
              <p className="text-[11px] text-muted-foreground">{dayFmt.format(new Date(e.completedAt))}</p>
            </li>
          ))}
        </ul>
        {delta !== null && (
          <p className={cn("flex items-center gap-1.5 text-xs font-medium", delta >= 0 ? "text-secondary" : "text-gold")}>
            {delta >= 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
            {delta >= 0 ? "+" : ""}
            {delta} puntos vs. tu promedio anterior
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Verde ≥ {PLAN_ALTO} % · Amarillo {PLAN_BAJO}–{PLAN_ALTO - 1} % · Rojo &lt; {PLAN_BAJO} %. Solo cuentan tus últimos {ULTIMOS} exámenes.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold">Evolución examen por examen</p>
        <TrendChart scores={done.map((s) => ({ id: s.exam.id, score: s.exam.score, date: s.exam.completedAt }))} />
      </div>

      <div className="lg:col-span-2">
        <SubjectHeatmap examIds={recent.exams.map((e) => e.id)} dates={recent.exams.map((e) => e.completedAt)} />
      </div>
    </div>
  );
}

/* ─────────────────────────── Línea temporal ─────────────────────────── */

function TrendChart({ scores }: { scores: { id: number; score: number; date: string }[] }) {
  const W = 320;
  const H = 150;
  const pad = { l: 28, r: 10, t: 10, b: 20 };
  const n = scores.length;
  const x = (i: number) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + ((100 - v) * (H - pad.t - pad.b)) / 100;
  const path = scores.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.score).toFixed(1)}`).join(" ");
  const recentFrom = n - ULTIMOS;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Calificaciones: ${scores.map((s) => `${s.score}%`).join(", ")}`}>
        {/* Bandas de estatus */}
        <rect x={pad.l} y={y(100)} width={W - pad.l - pad.r} height={y(PLAN_ALTO) - y(100)} fill="var(--secondary)" opacity={0.08} />
        <rect x={pad.l} y={y(PLAN_ALTO)} width={W - pad.l - pad.r} height={y(PLAN_BAJO) - y(PLAN_ALTO)} fill="var(--gold)" opacity={0.08} />
        <rect x={pad.l} y={y(PLAN_BAJO)} width={W - pad.l - pad.r} height={y(0) - y(PLAN_BAJO)} fill="var(--destructive)" opacity={0.08} />
        {[0, PLAN_BAJO, PLAN_ALTO, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray={v % 100 ? "3 3" : undefined} />
            <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--muted-foreground)">
              {v}
            </text>
          </g>
        ))}
        {n > 1 && <path d={path} fill="none" stroke="var(--brand-light)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {scores.map((s, i) => (
          <circle
            key={s.id}
            cx={x(i)}
            cy={y(s.score)}
            r={i >= recentFrom ? 4.5 : 3}
            fill={i >= recentFrom ? ESTADOS[estadoDe(s.score)].fill : "var(--card)"}
            stroke={i >= recentFrom ? "var(--card)" : "var(--brand-light)"}
            strokeWidth={1.5}
          >
            <title>{`${dayFmt.format(new Date(s.date))}: ${s.score}%`}</title>
          </circle>
        ))}
        <text x={pad.l} y={H - 4} fontSize="9" fill="var(--muted-foreground)">
          1.º
        </text>
        {n > 1 && (
          <text x={W - pad.r} y={H - 4} fontSize="9" textAnchor="end" fill="var(--muted-foreground)">
            {n}.º
          </text>
        )}
      </svg>
      <p className="text-xs text-muted-foreground">Los puntos grandes son tus últimos {Math.min(ULTIMOS, n)} exámenes.</p>
    </>
  );
}

/* ─────────────────────────── Mapa de calor ─────────────────────────── */

function SubjectHeatmap({ examIds, dates }: { examIds: number[]; dates: string[] }) {
  const [data, setData] = React.useState<Map<number, MateriaSummary[]> | null>(null);
  const [failed, setFailed] = React.useState(false);
  const key = examIds.join(",");

  React.useEffect(() => {
    let active = true;
    getMateriasDe(key.split(",").map(Number))
      .then((d) => active && setData(d))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [key]);

  if (failed) return null;
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" aria-label="Cargando materias" />;

  // Filas = materias, columnas = últimos exámenes + promedio. Orden: de la más débil a la más fuerte.
  const materias = new Map<string, { nombre: string; porExamen: (number | null)[]; correctas: number; total: number }>();
  examIds.forEach((id, col) => {
    for (const m of data.get(id) ?? []) {
      const row = materias.get(m.materia_clave) ?? { nombre: m.materia, porExamen: examIds.map(() => null), correctas: 0, total: 0 };
      row.porExamen[col] = m.total > 0 ? Math.round((m.correctas / m.total) * 100) : 0;
      row.correctas += m.correctas;
      row.total += m.total;
      materias.set(m.materia_clave, row);
    }
  });
  const rows = [...materias.values()]
    .map((r) => ({ ...r, avg: r.total > 0 ? Math.round((r.correctas / r.total) * 100) : 0 }))
    .sort((a, b) => a.avg - b.avg);

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">Mapa de calor por materia</p>
        <p className="text-xs text-muted-foreground">Aciertos en tus últimos {examIds.length} exámenes. Arriba, lo que necesita refuerzo urgente.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-80 border-separate border-spacing-1 text-sm">
          <thead>
            <tr className="text-[11px] text-muted-foreground">
              <th className="text-left font-medium">Materia</th>
              {dates.map((d, i) => (
                <th key={i} className="w-14 font-medium">
                  {dayFmt.format(new Date(d))}
                </th>
              ))}
              <th className="w-16 font-semibold text-foreground">Prom.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.nombre}>
                <th scope="row" className="max-w-40 truncate pr-2 text-left font-medium">
                  {r.nombre}
                </th>
                {r.porExamen.map((v, i) => (
                  <HeatCell key={i} value={v} />
                ))}
                <HeatCell value={r.avg} strong />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeatCell({ value, strong }: { value: number | null; strong?: boolean }) {
  if (value === null) return <td className="rounded-md bg-muted/40 text-center text-xs text-muted-foreground">—</td>;
  const estado = ESTADOS[estadoDe(value)];
  // Más intenso mientras más lejos esté del umbral (dominada o urgente).
  const alpha = value >= PLAN_ALTO ? 0.25 + ((value - PLAN_ALTO) / (100 - PLAN_ALTO)) * 0.45 : value < PLAN_BAJO ? 0.25 + ((PLAN_BAJO - value) / PLAN_BAJO) * 0.45 : 0.3;
  return (
    <td
      className={cn("h-9 rounded-md text-center text-xs tabular-nums", strong ? "font-bold" : "font-semibold")}
      style={{ backgroundColor: `color-mix(in srgb, ${estado.fill} ${Math.round(alpha * 100)}%, transparent)` }}
    >
      {value}%
    </td>
  );
}
