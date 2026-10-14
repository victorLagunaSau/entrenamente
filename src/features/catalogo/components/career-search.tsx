"use client";

import * as React from "react";
import { Check, CircleAlert, Clock, Loader2, RotateCcw, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { InstitucionIcon } from "@/features/identidad";
import { cn } from "@/lib/utils";

import { useIndiceCarreras, useOpcionCarrera } from "../hooks/use-catalogo";
import { BUSQUEDA_MIN, BUSQUEDA_PAUSA_MS, buscarCarreras, type OpcionCarrera } from "../lib/buscar";

const MAX_VISIBLES = 30;

export type CareerChoice = { universityId: string; careerId: string };

/**
 * Buscador global Carrera → Universidad (registro de estudiante y padre, invitaciones, metas).
 * Tolera errores de dedo y acentos; busca desde 3 letras, tras una pausa al dejar de escribir.
 * Las carreras sin reactivos se ven como "Próximamente" y sí se pueden elegir.
 */
export function CareerSearch({
  value,
  onChange,
  taken,
  takenLabel = "Ya la tienes",
  id,
  invalid,
  describedBy,
  autoFocus,
}: {
  /** id de la carrera elegida. */
  value: string | null;
  onChange: (choice: CareerChoice | null) => void;
  /** Carreras que ya son metas: se ven pero no se eligen. */
  taken?: Set<string>;
  takenLabel?: string;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const { indice, error, retry } = useIndiceCarreras();
  const selected = useOpcionCarrera(value);
  const [q, setQ] = React.useState("");
  // Texto ya buscado (tras la pausa o Enter); los resultados se calculan sobre él.
  const [buscado, setBuscado] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  const texto = q.trim();
  const corto = texto.length < BUSQUEDA_MIN;
  const esperando = !corto && texto !== buscado;

  React.useEffect(() => {
    if (corto) {
      setBuscado("");
      return;
    }
    const t = setTimeout(() => setBuscado(texto), BUSQUEDA_PAUSA_MS);
    return () => clearTimeout(t);
  }, [texto, corto]);

  const resultados = React.useMemo(() => (indice && buscado ? buscarCarreras(indice, buscado) : []), [indice, buscado]);

  const choose = (o: OpcionCarrera) => {
    onChange({ universityId: o.institucion.id, careerId: o.carrera.id });
  };

  if (selected) {
    return (
      <div className="flex flex-col gap-2">
        <OpcionCard opcion={selected} selected />
        <button
          type="button"
          onClick={() => {
            onChange(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="self-start rounded-md px-1 py-1 text-sm font-semibold text-brand-light underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Cambiar carrera
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          id={id}
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-controls={listId}
          placeholder="Ej. Derecho, Arquitectura UNAM…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            // Enter busca ya (sin esperar la pausa) y no envía el formulario del registro.
            if (e.key === "Enter") {
              e.preventDefault();
              if (!corto) setBuscado(texto);
            }
          }}
          className="h-12 pr-10 pl-9 text-base [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div id={listId} aria-live="polite" className="flex flex-col gap-2">
        {error && !indice ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert">
            <CircleAlert className="size-4 shrink-0" /> No pudimos cargar las carreras.
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              <RotateCcw className="size-3.5" /> Reintentar
            </button>
          </p>
        ) : corto ? (
          <p className="text-sm text-muted-foreground">
            {texto
              ? `Escribe al menos ${BUSQUEDA_MIN} letras.`
              : "Escribe la carrera; puedes agregar la universidad (ej. «derecho unam»)."}
          </p>
        ) : esperando || !indice ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> Buscando…
          </p>
        ) : resultados.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No encontramos «{buscado}». Revisa cómo se escribe o busca solo una palabra (ej. «ingeniería»).
          </p>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground">
              {resultados.length === 1 ? "1 opción" : `${resultados.length} opciones`}
              {resultados.length > MAX_VISIBLES && ` · se muestran ${MAX_VISIBLES}, escribe más para afinar`}
            </p>
            <ul className="flex max-h-[22rem] flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
              {resultados.slice(0, MAX_VISIBLES).map((o) => {
                const ya = taken?.has(o.carrera.id) ?? false;
                return (
                  <li key={o.carrera.id}>
                    <OpcionCard opcion={o} disabled={ya} note={ya ? takenLabel : undefined} onClick={() => choose(o)} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** Tarjeta "Carrera · Universidad" con el color e ícono de la institución. */
export function OpcionCard({
  opcion: { carrera, institucion, area },
  selected,
  disabled,
  note,
  onClick,
}: {
  opcion: OpcionCarrera;
  selected?: boolean;
  disabled?: boolean;
  note?: string;
  onClick?: () => void;
}) {
  const proximamente = carrera.conReactivos === false;
  const body = (
    <>
      <span
        className="grid size-10 shrink-0 place-items-center rounded-lg"
        style={{ background: `var(--uni-${institucion.id}, var(--muted))` }}
      >
        <InstitucionIcon
          id={institucion.id}
          label=""
          color={`var(--uni-${institucion.id}-fg, #ffffff)`}
          className="size-5"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm leading-snug font-semibold text-foreground">{carrera.nombre}</span>
        <span className="truncate text-xs text-muted-foreground">
          <span className="font-semibold text-cool">{institucion.sigla}</span>
          {area ? ` · ${area}` : ` · ${institucion.nombre}`}
        </span>
        {proximamente && (
          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">
            <Clock className="size-3" aria-hidden /> Próximamente
          </span>
        )}
      </span>
      {note ? (
        <span className="shrink-0 text-xs text-muted-foreground">{note}</span>
      ) : (
        selected && (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        )
      )}
    </>
  );

  const cls = cn(
    "flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors",
    selected ? "border-primary bg-primary/10" : "border-border bg-background/40",
  );

  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        cls,
        "hover:border-brand-light/60 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {body}
    </button>
  );
}

/** Aviso bajo la carrera elegida cuando aún no tiene reactivos. */
export function ProximamenteNote({ careerId }: { careerId: string | null }) {
  const o = useOpcionCarrera(careerId);
  if (o?.carrera.conReactivos !== false) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
      Estamos preparando los reactivos de esta carrera. Puedes registrarte y te avisaremos en cuanto esté lista.
    </p>
  );
}
