"use client";

import * as React from "react";
import Link from "next/link";
import { BellOff, CircleAlert, Flame, Loader2, PencilLine, RotateCcw, ShieldAlert, Timer, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

import { type ExamTarget, formatClock, timeLimitOf } from "../../lib/libre";
import { cambioNivel } from "../../lib/racha";
import type { RachaGame } from "../../services/racha-service";
import { buzz, LevelLadder, PhoneFrame, StreakBadge } from "./racha-parts";

/** Los mismos 4 avisos del Examen Libre, en versión corta. */
const AVISOS = [
  { icon: BellOff, title: "Modo enfoque", text: "Silencia notificaciones y busca un lugar tranquilo." },
  { icon: PencilLine, title: "Papel y lápiz", text: "Tenlos a la mano para las cuentas." },
  { icon: Zap, title: "Sin pausa", text: "Si sales, la partida se pierde." },
  { icon: ShieldAlert, title: "Solo práctica", text: "No garantiza tu ingreso a ninguna escuela." },
];

/**
 * Antes de jugar: nivel (lo decide tu última racha), avisos y "¡A jugar!". La partida se arma mientras tanto;
 * tocar el botón equivale a aceptar los avisos.
 */
export function RachaLobby({
  target,
  game,
  streak,
  error,
  onRetry,
  onStart,
}: {
  target: ExamTarget;
  game: RachaGame | null;
  streak: { dias: number; jugoHoy: boolean } | null;
  error: string | null;
  onRetry: () => void;
  onStart: () => void;
}) {
  const empty = game?.items.length === 0;
  const segundos = game ? timeLimitOf(game.items) : 0;

  return (
    <PhoneFrame>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, rgb(255 94 26 / 0.35), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative flex min-h-dvh flex-col gap-5 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-3">
          <Link href="/app/student" aria-label="Salir" className="grid size-10 place-items-center rounded-full bg-card/80 text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </Link>
          <p className="min-w-0 truncate rounded-full bg-card/80 px-3 py-1.5 text-xs font-semibold">
            {target.institucion.clave} · {target.carrera.nombre}
          </p>
        </header>

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-energy/15 animate-pulse-glow">
            <Flame className="size-10 fill-energy/40 text-energy" />
          </span>
          <h1 className="font-display text-4xl font-black tracking-tight uppercase italic">Racha</h1>
          {streak && streak.dias > 0 ? (
            <StreakBadge days={streak.dias} />
          ) : (
            <p className="text-sm text-muted-foreground">Juega hoy y enciende tu racha.</p>
          )}
        </div>

        <section className="rounded-3xl border bg-card/80 p-4" aria-live="polite">
          {game ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Tu nivel</p>
                <LevelMessage game={game} />
              </div>
              <LevelLadder nivel={game.nivel} className="mt-3" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Chip icon={Zap} value={String(game.items.length)} label="preguntas" />
                <Chip icon={Timer} value={formatClock(segundos, true)} label="para todo" />
              </div>
            </>
          ) : error ? (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          ) : (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-energy motion-reduce:animate-none" /> Armando tu partida…
            </p>
          )}
        </section>

        <ul className="grid grid-cols-2 gap-2" aria-label="Antes de jugar">
          {AVISOS.map((a) => (
            <li key={a.title} className="flex flex-col gap-1 rounded-2xl border bg-card/60 p-3">
              <a.icon className="size-5 text-energy" aria-hidden />
              <p className="text-sm font-bold">{a.title}</p>
              <p className="text-xs leading-snug text-muted-foreground">{a.text}</p>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-2">
          {error ? (
            <Button size="lg" variant="outline" className="h-14 rounded-2xl text-base" onClick={onRetry}>
              <RotateCcw /> Reintentar
            </Button>
          ) : (
            <Button
              size="lg"
              variant="energy"
              disabled={!game || empty}
              onClick={() => {
                buzz(20);
                onStart();
              }}
              className="h-16 rounded-2xl font-display text-xl font-black tracking-wide uppercase italic"
            >
              {empty ? "Sin preguntas por ahora" : "¡A jugar!"}
            </Button>
          )}
          <p className="text-center text-[11px] leading-snug text-muted-foreground/80 text-pretty">
            Al jugar aceptas los avisos. {BRAND.name} es una herramienta independiente de práctica: no es una evaluación oficial.
          </p>
        </div>
      </div>
    </PhoneFrame>
  );
}

function LevelMessage({ game }: { game: RachaGame }) {
  if (!game.anterior) return <span className="text-xs font-semibold text-secondary">Primera partida</span>;
  const dir = cambioNivel(game.anterior.nivel, game.nivel);
  return (
    <span className={cn("text-xs font-semibold", dir === "sube" ? "text-secondary" : dir === "baja" ? "text-energy" : "text-gold")}>
      {dir === "sube" ? "¡Subiste de nivel!" : dir === "baja" ? "Recupera tu nivel" : game.nivel === "dificil" ? "En la cima" : "Súbelo hoy"}
    </span>
  );
}

function Chip({ icon: Icon, value, label }: { icon: typeof Zap; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-background/60 px-3 py-2.5">
      <Icon className="size-4 text-energy" aria-hidden />
      <span className="font-mono text-lg font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** 3 · 2 · 1 · ¡YA! con vibración en cada número. */
export function RachaCountdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = React.useState(3);
  const done = React.useRef(onDone);
  done.current = onDone;

  React.useEffect(() => {
    buzz(n > 0 ? 40 : [60, 40, 120]);
    const t = setTimeout(() => (n > 0 ? setN(n - 1) : done.current()), n > 0 ? 800 : 600);
    return () => clearTimeout(t);
  }, [n]);

  return (
    <PhoneFrame>
      <div className="grid min-h-dvh place-items-center" role="status" aria-live="assertive">
        <span
          key={n}
          className={cn(
            "font-display font-black italic animate-racha-count motion-reduce:animate-none",
            n > 0 ? "text-[9rem] leading-none text-foreground" : "text-7xl text-energy-glow uppercase"
          )}
        >
          {n > 0 ? n : "¡Ya!"}
        </span>
      </div>
    </PhoneFrame>
  );
}
