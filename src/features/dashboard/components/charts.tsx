"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { EXAM_TYPE_LABEL, EXAM_TYPES, type MateriaRow, type WeekPoint } from "../lib/tutor-stats";

const shortDate = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });

/**
 * Evolución semanal del % de aciertos (una sola serie: no lleva leyenda). Eje Y fijo 0–100.
 * Las semanas sin exámenes no tienen punto; la línea une las semanas con datos.
 */
export function WeeklyScoreChart({ weeks, interactive = true }: { weeks: WeekPoint[]; interactive?: boolean }) {
  const [hover, setHover] = React.useState<number | null>(null);
  // Se dibuja al ancho real del contenedor para que el texto no se encoja en el celular.
  const ref = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(640);
  React.useEffect(() => {
    const el = ref.current;
    // En el reporte impreso el contenedor está oculto (ancho 0): se usa el ancho fijo y el SVG escala.
    if (!el || !interactive) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [interactive]);
  const H = W < 480 ? 200 : 240;
  const pad = { top: 16, right: 24, bottom: 28, left: 40 };
  // Etiquetas de fecha: cada 2 semanas, o cada 3 en pantallas angostas (siempre incluye la actual).
  const every = W < 480 ? 3 : 2;
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (weeks.length === 1 ? iw / 2 : (i * iw) / (weeks.length - 1));
  const y = (v: number) => pad.top + ih - (v / 100) * ih;
  const points = weeks.map((w, i) => ({ ...w, i })).filter((w) => w.accuracy !== null);
  const path = points.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.accuracy!).toFixed(1)}`).join(" ");
  const active = hover !== null ? weeks[hover] : null;

  return (
    <div ref={ref} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={interactive ? W : undefined}
        height={interactive ? H : undefined}
        className={interactive ? "block max-w-full" : "h-auto w-full"}
        role="img"
        aria-label={`Porcentaje de aciertos por semana. ${points.map((p) => `Semana del ${shortDate(p.weekStart)}: ${p.accuracy}%`).join(". ")}`}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {v}%
            </text>
          </g>
        ))}
        {weeks.map((w, i) =>
          (weeks.length - 1 - i) % every === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {shortDate(w.weekStart)}
            </text>
          ) : null
        )}
        {active && hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + ih} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
        )}
        {points.length > 1 && (
          <path d={path} fill="none" stroke="var(--brand-light)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {points.map((p) => (
          <circle
            key={p.i}
            cx={x(p.i)}
            cy={y(p.accuracy!)}
            r={hover === p.i ? 6 : 4.5}
            fill="var(--brand-light)"
            stroke="var(--card)"
            strokeWidth={2}
          />
        ))}
        {interactive &&
          weeks.map((_, i) => (
            <rect
              key={i}
              x={x(i) - iw / weeks.length / 2}
              y={pad.top}
              width={iw / weeks.length}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
      </svg>
      {interactive && active && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="text-muted-foreground">Semana del {shortDate(active.weekStart)}</p>
          {active.accuracy === null ? (
            <p className="font-medium">Sin exámenes</p>
          ) : (
            <p className="font-semibold text-foreground">
              {active.accuracy}% de aciertos · {active.exams} {active.exams === 1 ? "examen" : "exámenes"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Escala secuencial de un solo tono (turquesa de la marca): más aciertos = más intenso.
const cellStyle = (v: number | null): React.CSSProperties =>
  v === null ? {} : { backgroundColor: `color-mix(in oklab, var(--secondary) ${Math.round(12 + (v / 100) * 70)}%, var(--card))` };

/** Mapa de calor: materias × modalidad. El número va en cada celda (el color nunca es la única pista). */
export function MateriaHeatmap({ rows, className }: { rows: MateriaRow[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[19rem] border-separate border-spacing-0.5 text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="py-1.5 pr-1 pl-0 text-left font-medium sm:px-2">Materia</th>
              {EXAM_TYPES.map((t) => (
                <th key={t.id} scope="col" className="px-1 py-1.5 text-center font-medium sm:px-2">
                  <span className="sm:hidden">{EXAM_TYPE_LABEL[t.id]}</span>
                  <span className="hidden sm:inline print:inline">{t.label}</span>
                </th>
              ))}
              <th scope="col" className="px-1 py-1.5 text-center font-semibold text-cool sm:px-2">General</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.materia}>
                <th scope="row" className="max-w-28 truncate py-2 pr-1 pl-0 sm:max-w-44 sm:px-2 text-left font-medium">
                  {r.materia}
                </th>
                {EXAM_TYPES.map((t) => (
                  <HeatCell key={t.id} value={r.byType[t.id]} />
                ))}
                <HeatCell value={r.overall} strong />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden>
        <span>Mayor % de error</span>
        <span
          className="h-2 w-28 rounded-full"
          style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--secondary) 12%, var(--card)), color-mix(in oklab, var(--secondary) 82%, var(--card)))" }}
        />
        <span>Dominada</span>
      </div>
    </div>
  );
}

function HeatCell({ value, strong }: { value: number | null; strong?: boolean }) {
  return (
    <td
      className={cn(
        "rounded-md px-1.5 py-2 text-center tabular-nums sm:px-2",
        value === null ? "text-muted-foreground" : value >= 75 ? "text-secondary-foreground" : "text-foreground",
        strong && "font-bold"
      )}
      style={cellStyle(value)}
      title={value === null ? "Sin preguntas en esta modalidad" : `${value}% de aciertos`}
    >
      {value === null ? "—" : `${value}%`}
    </td>
  );
}
