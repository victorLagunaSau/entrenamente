"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Download,
  FileText,
  Gift,
  Home,
  Hourglass,
  LogOut,
  NotebookPen,
  Share2,
  Target,
  Timer,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { type ExamRecord, formatClock, type MateriaSummary, NIVELES, type SnapshotQuestion, UNI_ACCENT } from "../../lib/libre";
import { formatScore } from "../../types";
import { MathText } from "../math-text";
import { AnswerOptions, FeedbackDetails, letterAt, QuestionPrompt, ReadingBlock, ResultBanner, scoreTone } from "../question-parts";
import { orderedOptions, PrintSheet, shareText, usePrint } from "./report-print";
import { UniBar } from "./uni-bar";

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" });
const EXAM_TYPES: Record<ExamRecord["examType"], string> = { libre: "Libre", plan: "Plan", racha: "Racha" };

type Numbered = { q: SnapshotQuestion; n: number };

/**
 * Reporte de un examen congelado: ficha con folio, prioridad de estudio (fallas por materia con
 * diagnóstico y solución paso a paso), aciertos por materia, visor completo, PDF y compartir.
 * La experiencia termina aquí: se sale al home; otro examen se inicia desde fuera.
 */
export function ExamReport({ record, tutor = false }: { record: ExamRecord; tutor?: boolean }) {
  // El padre o maestro lo ve desde su panel: sale a su panel y el texto habla del estudiante.
  const home = tutor ? "/app/dashboard" : "/app/student";
  const [view, setView] = React.useState<"resumen" | "completo">("resumen");
  const { kind: printing, print } = usePrint();
  const numbered: Numbered[] = record.questions.map((q, i) => ({ q, n: i + 1 }));
  const fallas = numbered.filter(({ q }) => q.ponderacion_obtenida < 1);
  const aciertos = numbered.filter(({ q }) => q.ponderacion_obtenida >= 1);

  const show = (v: typeof view) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="flex min-h-dvh flex-col print:hidden">
        <header className="sticky top-0 z-30">
          <UniBar target={record.target}>
            {record.folio && (
              <span className="hidden rounded-full bg-white/15 px-3 py-1 font-mono text-xs font-semibold sm:inline">{record.folio}</span>
            )}
            <Button asChild size="sm" className="bg-white font-bold text-black hover:bg-white/90">
              <Link href={home}>
                <LogOut /> {tutor ? "Volver al panel" : "Salir"}
              </Link>
            </Button>
          </UniBar>
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
          {view === "completo" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Examen completo</h1>
                <Button variant="outline" onClick={() => show("resumen")}>
                  <ArrowLeft /> Volver al resumen
                </Button>
              </div>
              <p className="-mt-3 text-sm text-muted-foreground">
                {record.folio && `Folio ${record.folio} · `}Tal como lo {tutor ? "presentó" : "presentaste"}: {dateFmt.format(new Date(record.completedAt))}
              </p>
              {numbered.map(({ q, n }, k) => (
                <React.Fragment key={q.id_original}>
                  {(k === 0 || numbered[k - 1].q.materia !== q.materia) && <MateriaHeading name={q.materia} />}
                  <article className="rounded-3xl border bg-card p-4 sm:p-6">
                    <FrozenQuestion q={q} n={n} total={record.totalQuestions} />
                  </article>
                </React.Fragment>
              ))}
              <Button variant="outline" className="w-fit" onClick={() => show("resumen")}>
                <ArrowLeft /> Volver al resumen
              </Button>
            </>
          ) : (
            <>
              <Ficha record={record} aciertos={aciertos.length} onPrint={print} onVerCompleto={() => show("completo")} />
              <StudyPriority fallas={fallas} total={record.totalQuestions} tutor={tutor} onPrintGuide={() => print("guia")} />
              <Aciertos aciertos={aciertos} materias={record.materias} total={record.totalQuestions} />
              <Button asChild variant="outline" className="w-fit self-center">
                <Link href={home}>
                  <Home /> {tutor ? "Volver al panel" : "Ir a mi home"}
                </Link>
              </Button>
            </>
          )}
        </main>
      </div>
      <PrintSheet record={record} kind={printing} />
    </>
  );
}

const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);

function Ficha({
  record,
  aciertos,
  onPrint,
  onVerCompleto,
}: {
  record: ExamRecord;
  aciertos: number;
  onPrint: (kind: "guia" | "resumen") => void;
  onVerCompleto: () => void;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Ficha del examen
            {record.pruebaNumero !== null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-light/40 bg-primary/10 px-2 py-0.5 tracking-normal text-brand-light normal-case">
                <Gift className="size-3" aria-hidden /> Prueba gratuita {record.pruebaNumero}
              </span>
            )}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-balance">
            {record.universityKey} · {record.careerName}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="size-4" /> {dateFmt.format(new Date(record.completedAt))}
          </p>
          {record.folio && <FolioChip folio={record.folio} />}
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-bold tabular-nums">
            {formatScore(record.score)}
            <span className="text-lg font-medium text-muted-foreground"> / {formatScore(record.maxScore)}</span>
          </p>
          <p className="text-sm text-muted-foreground">Calificación bruta</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Target} label="Aciertos" value={`${aciertos} de ${record.totalQuestions} (${pct(aciertos, record.totalQuestions)} %)`} />
        <Stat icon={ClipboardList} label="Respondidas" value={`${record.answeredQuestions} de ${record.totalQuestions}`} />
        <Stat icon={Timer} label="Tiempo usado" value={`${formatClock(record.timeSpentSeconds)} de ${formatClock(record.timeLimitSeconds)}`} />
        <Stat
          icon={NotebookPen}
          label="Tipo · Nivel"
          value={`${EXAM_TYPES[record.examType]} · ${NIVELES.find((n) => n.value === record.level)?.nombre ?? record.level}`}
        />
      </dl>

      {record.timedOut && (
        <p className="flex items-center gap-2 rounded-xl border border-energy/40 bg-energy/10 px-3 py-2 text-sm text-energy">
          <Hourglass className="size-4 shrink-0" /> Se agotó el tiempo: se calificó con lo que llevabas respondido.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-md text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Materia</th>
              <th className="px-3 py-2 text-right font-medium">Aciertos</th>
              <th className="px-3 py-2 font-medium">% aciertos</th>
              <th className="py-2 pl-3 text-right font-medium">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {record.materias.map((m) => (
              <tr key={m.materia_clave} className="border-b last:border-0">
                <td className="py-2.5 pr-3 font-medium">{m.materia}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {m.correctas}/{m.total}
                </td>
                <td className="px-3 py-2.5">
                  <PctBar value={m.porcentaje_aciertos} />
                </td>
                <td className="py-2.5 pl-3 text-right font-mono tabular-nums">
                  {formatScore(m.puntos)}/{formatScore(m.maximo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onVerCompleto}>
          <ClipboardList /> Ver Examen Completo
        </Button>
        <Button variant="outline" onClick={() => onPrint("resumen")}>
          <FileText /> Resumen en PDF
        </Button>
        <ShareButton record={record} />
      </div>
    </section>
  );
}

function FolioChip({ folio }: { folio: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(folio);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="mt-2 inline-flex items-center gap-2 rounded-lg border bg-background/60 px-2.5 py-1 text-xs hover:bg-accent"
      aria-label={`Copiar folio ${folio}`}
    >
      <span className="text-muted-foreground">Folio</span>
      <span className="font-mono font-semibold tracking-wide">{folio}</span>
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5 text-muted-foreground" />}
    </button>
  );
}

/** Comparte el resumen en texto (hoja nativa del teléfono) o lo copia al portapapeles. */
function ShareButton({ record }: { record: ExamRecord }) {
  const [status, setStatus] = React.useState<"idle" | "copied">("idle");
  const share = async () => {
    const text = shareText(record);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Examen ${record.folio}`, text });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {}
  };
  return (
    <Button variant="outline" onClick={share}>
      {status === "copied" ? <Check /> : <Share2 />} {status === "copied" ? "Resumen copiado" : "Compartir"}
    </Button>
  );
}

/** Módulo visualmente separado: tarjeta propia con franja superior del color institucional. */
function Module({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Timer;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 overflow-hidden rounded-3xl border border-t-4 bg-card p-4 shadow-sm sm:p-6" style={{ borderTopColor: UNI_ACCENT }}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Fallas: la guía de errores al frente y, por materia, el resumen visible con sus preguntas plegables. */
function StudyPriority({
  fallas,
  total,
  tutor,
  onPrintGuide,
}: {
  fallas: Numbered[];
  total: number;
  tutor: boolean;
  onPrintGuide: () => void;
}) {
  return (
    <Module
      icon={BookOpenCheck}
      title="Prioridad de estudio"
      subtitle={
        fallas.length === 0
          ? `¡Sin fallas! ${tutor ? "Respondió" : "Respondiste"} todo correctamente.`
          : `${fallas.length} ${fallas.length === 1 ? "pregunta" : "preguntas"} para repasar: diagnóstico y cómo resolverla paso a paso.`
      }
    >
      {fallas.length > 0 && (
        <div className="flex flex-col items-start gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <FileText className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-primary">Guía de errores</p>
            <p className="text-sm text-muted-foreground text-pretty">
              Descárgala o imprímela: cada pregunta que salió mal con su diagnóstico y la solución paso a paso, por materia. Úsala para
              practicar antes de{tutor ? " su" : " tu"} siguiente examen.
            </p>
          </div>
          <Button size="lg" onClick={onPrintGuide} className="w-full shrink-0 sm:w-auto">
            <Download /> Descargar guía de errores (PDF)
          </Button>
        </div>
      )}

      {groupByMateria(fallas).map(([materia, list]) => (
        <MateriaGroup
          key={materia}
          name={materia}
          count={list.length}
          summary={`${list.length} por repasar`}
        >
          {list.map(({ q, n }) => (
            <QuestionAccordion key={q.id_original} q={q} n={n} total={total} />
          ))}
        </MateriaGroup>
      ))}
    </Module>
  );
}

/** Aciertos por materia: resumen siempre visible; las preguntas se despliegan. */
function Aciertos({ aciertos, materias, total }: { aciertos: Numbered[]; materias: MateriaSummary[]; total: number }) {
  return (
    <Module
      icon={Trophy}
      title={`Aciertos · ${aciertos.length}`}
      subtitle={aciertos.length === 0 ? "Aún no hay aciertos en este examen. ¡Tú puedes!" : "Lo que ya dominas, por materia. Ábrelas para repasar."}
    >
      {materias.map((m) => {
        const list = aciertos.filter(({ q }) => q.materia === m.materia);
        return (
          <MateriaGroup
            key={m.materia_clave}
            name={m.materia}
            count={list.length}
            summary={
              <>
                {m.correctas} de {m.total} correctas <PctBar value={m.porcentaje_aciertos} />
              </>
            }
          >
            {list.map(({ q, n }) => (
              <QuestionAccordion key={q.id_original} q={q} n={n} total={total} />
            ))}
          </MateriaGroup>
        );
      })}
    </Module>
  );
}

/** Materia plegable: el encabezado (nombre, conteo, resumen) siempre a la vista; sin preguntas no se abre. */
export function MateriaGroup({ name, count, summary, children }: { name: string; count: number; summary: React.ReactNode; children: React.ReactNode }) {
  const header = (
    <>
      <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: UNI_ACCENT }} />
      <span className="font-display text-base font-bold text-primary">{name}</span>
      <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-semibold">{count}</span>
      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">{summary}</span>
    </>
  );
  if (count === 0) {
    return <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed bg-background/60 px-4 py-3 opacity-80">{header}</div>;
  }
  return (
    <details className="group/materia rounded-2xl border bg-background/60">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        {header}
        <ChevronDown className="size-4 text-primary transition-transform group-open/materia:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 border-t p-3">{children}</div>
    </details>
  );
}

/** Pregunta plegable con diagnóstico y solución. `source` antepone su origen (p. ej. "Examen 2") cuando se mezclan exámenes. */
export function QuestionAccordion({ q, n, total, source }: { q: SnapshotQuestion; n: number; total: number; source?: string }) {
  return (
    <details className="group rounded-2xl border bg-card open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-3 sm:p-4 [&::-webkit-details-marker]:hidden">
        <span className={cn("mt-0.5 shrink-0 rounded-full border px-2 py-0.5 font-mono text-xs", scoreTone(q.ponderacion_obtenida))}>
          {formatScore(q.ponderacion_obtenida)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">
            {source && `${source} · `}Pregunta {n} · {q.materia} · {q.tiempo_respuesta_segundos} s
          </span>
          <MathText text={q.pregunta} className="line-clamp-2 text-sm font-medium group-open:line-clamp-none" />
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
          <span className="group-open:hidden">Ver</span>
          <span className="hidden group-open:inline">Cerrar</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t p-3 sm:p-4">
        <FrozenQuestion q={q} n={n} total={total} hidePrompt />
      </div>
    </details>
  );
}

function PctBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:w-32">
        <span className="block h-full rounded-full" style={{ width: `${value}%`, backgroundColor: UNI_ACCENT }} />
      </span>
      <span className="font-mono text-xs tabular-nums">{value} %</span>
    </span>
  );
}

function groupByMateria<T extends { q: SnapshotQuestion }>(list: T[]) {
  const map = new Map<string, T[]>();
  for (const x of list) map.set(x.q.materia, [...(map.get(x.q.materia) ?? []), x]);
  return [...map.entries()];
}

function MateriaHeading({ name }: { name: string }) {
  return (
    <h3 className="mt-2 flex items-center gap-2 font-display text-lg font-bold">
      <span className="h-5 w-1 rounded-full" style={{ backgroundColor: UNI_ACCENT }} /> {name}
    </h3>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-background/40 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Reactivo congelado tal como se respondió: mismas letras, respuesta elegida y retroalimentación. */
function FrozenQuestion({ q, n, total, hidePrompt = false }: { q: SnapshotQuestion; n: number; total: number; hidePrompt?: boolean }) {
  const options = orderedOptions(q);
  const correctIndex = options.findIndex((r) => r.ponderacion === 1);
  const unanswered = q.respuesta_seleccionada_id === null;

  return (
    <div className="flex flex-col gap-4">
      {!hidePrompt && (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Pregunta {n} de {total} · {q.materia}
          </p>
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 font-mono text-xs", scoreTone(q.ponderacion_obtenida))}>
            {formatScore(q.ponderacion_obtenida)}
          </span>
        </div>
      )}
      {q.lectura && <ReadingBlock text={q.lectura} />}
      {!hidePrompt && <QuestionPrompt text={q.pregunta} />}
      <AnswerOptions options={options} picked={q.respuesta_seleccionada_id} disabled reveal dimOthers />
      <ResultBanner
        score={q.ponderacion_obtenida}
        title={unanswered ? "Sin responder" : undefined}
        detail={`Tiempo en la pregunta: ${q.tiempo_respuesta_segundos} s`}
      />
      <FeedbackDetails
        diagnostico={q.diagnostico_error}
        correct={correctIndex >= 0 ? { letter: letterAt(correctIndex), texto: options[correctIndex].texto } : null}
        steps={q.solucion_paso_a_paso}
        stepByStep
      />
    </div>
  );
}
