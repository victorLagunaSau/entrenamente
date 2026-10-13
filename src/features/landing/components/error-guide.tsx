import { FileDown, Target, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

/** Reporte de ejemplo: precisión por materia y reactivos por repasar (datos ilustrativos). */
const MATERIAS = [
  { nombre: "Matemáticas", precision: 84, repasar: 3 },
  { nombre: "Física", precision: 71, repasar: 5 },
  { nombre: "Química", precision: 58, repasar: 7 },
  { nombre: "Literatura", precision: 41, repasar: 10 },
];

const tono = (p: number) => (p > 75 ? "bg-secondary text-secondary" : p >= 50 ? "bg-gold text-gold" : "bg-energy text-energy");

function Donut({ value }: { value: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-32 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <defs>
          <linearGradient id="donut-brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#12c2a9" />
            <stop offset="100%" stopColor="#1e6fe6" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#donut-brand)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl font-bold tabular-nums">{value}%</p>
          <p className="text-[11px] text-muted-foreground">precisión</p>
        </div>
      </div>
    </div>
  );
}

const PUNTOS = [
  { icon: Target, text: "Tus temas débiles agrupados por materia, con el número exacto de reactivos por repasar." },
  { icon: TrendingUp, text: "Tu precisión de cada examen para ver si vas subiendo." },
  { icon: FileDown, text: "Tu Guía de errores y tu resumen en PDF para estudiar sin conexión." },
];

export function ErrorGuide() {
  return (
    <section aria-labelledby="guia-errores" className="reveal mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <SectionHeading
            id="guia-errores"
            eyebrow="Tu Guía de errores"
            title={
              <>
                Deja de estudiar todo. <span className="text-brand-gradient">Estudia lo que te falta.</span>
              </>
            }
            subtitle="Al terminar cada examen sabes exactamente dónde enfocar tu tiempo."
            className="lg:items-start lg:text-left"
          />
          <ul className="flex flex-col gap-4">
            {PUNTOS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-cool">
                <Icon className="mt-0.5 size-5 shrink-0 text-secondary" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden className="rounded-3xl border bg-card/80 p-5 shadow-2xl sm:p-7">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Donut value={68} />
            <div className="text-center sm:text-left">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Examen libre · UNAM</p>
              <p className="mt-1 font-display text-xl font-semibold">Tu reporte</p>
              <p className="mt-1 text-sm text-muted-foreground">25 reactivos por repasar en 4 materias</p>
            </div>
          </div>

          <ul className="mt-7 flex flex-col gap-4">
            {MATERIAS.map((m) => {
              const [bg, text] = tono(m.precision).split(" ");
              return (
                <li key={m.nombre}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{m.nombre}</span>
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", text, "bg-white/5")}>
                      {m.repasar} por repasar
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", bg)} style={{ width: `${m.precision}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{m.precision}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
