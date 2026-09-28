"use client";

import * as React from "react";

import { BRAND } from "@/lib/brand";

import { type ExamRecord, formatClock, NIVELES, type SnapshotQuestion } from "../../lib/libre";
import { formatScore } from "../../types";
import { MathText } from "../math-text";
import { letterAt } from "../question-parts";

export type PrintKind = "guia" | "resumen";

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" });
const nivelDe = (r: ExamRecord) => NIVELES.find((n) => n.value === r.level)?.nombre ?? r.level;
const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);

/** Opciones en el orden en que las vio el alumno (mismas letras que en el examen). */
export function orderedOptions(q: SnapshotQuestion) {
  return q.orden_opciones.length
    ? q.orden_opciones.map((id) => q.respuestas.find((r) => r.id === id)).filter((r) => r !== undefined)
    : q.respuestas;
}

/**
 * Abre el diálogo de impresión con la hoja pedida; desde ahí se guarda como PDF.
 * La hoja existe solo para imprimir (`print:block`); la pantalla se oculta con `print:hidden`.
 */
export function usePrint() {
  const [kind, setKind] = React.useState<PrintKind | null>(null);

  React.useEffect(() => {
    if (!kind) return;
    const done = () => setKind(null);
    window.addEventListener("afterprint", done);
    // Un cuadro para que la hoja se pinte antes de imprimir.
    const id = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("afterprint", done);
    };
  }, [kind]);

  return { kind, print: setKind };
}

const TIPOS: Record<ExamRecord["examType"], string> = { libre: "libre", plan: "del plan", racha: "racha" };

/** Resumen corto en texto para compartir (WhatsApp, correo…). */
export function shareText(r: ExamRecord) {
  const correctas = r.questions.filter((q) => q.ponderacion_obtenida >= 1).length;
  const lines = [
    `${BRAND.name} · Examen ${TIPOS[r.examType]}`,
    ...(r.folio ? [`Folio: ${r.folio}`] : []),
    `${r.universityName} · ${r.careerName}`,
    `${dateFmt.format(new Date(r.completedAt))} · Nivel ${nivelDe(r)}`,
    `Calificación: ${formatScore(r.score)} / ${formatScore(r.maxScore)} · Aciertos ${correctas} de ${r.totalQuestions} (${pct(correctas, r.totalQuestions)} %)`,
    `Tiempo: ${formatClock(r.timeSpentSeconds)} de ${formatClock(r.timeLimitSeconds)}`,
    "",
    "Por materia:",
    ...r.materias.map((m) => `• ${m.materia}: ${m.correctas}/${m.total} (${m.porcentaje_aciertos} %)`),
    "",
    "Simulacro de práctica: no es una evaluación oficial.",
  ];
  return lines.join("\n");
}

export function PrintSheet({ record, kind }: { record: ExamRecord; kind: PrintKind | null }) {
  if (!kind) return null;
  const fallas = record.questions.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => q.ponderacion_obtenida < 1);
  const materias = [...new Set(fallas.map(({ q }) => q.materia))];
  const correctas = record.questions.filter((q) => q.ponderacion_obtenida >= 1).length;

  return (
    <div className="hidden bg-white text-[11pt] leading-snug text-black print:block">
      <header className="mb-4 border-b-2 border-black pb-3">
        <p className="text-[9pt] tracking-widest uppercase">
          {BRAND.name} · {kind === "guia" ? "Guía de estudio" : "Resumen del examen"}
        </p>
        <h1 className="text-[18pt] font-bold" style={{ color: "black" }}>
          {record.universityName}
        </h1>
        <p>
          {record.careerName}
          {record.target.carrera.area && ` · ${record.target.carrera.area}`}
        </p>
        <p className="mt-1 text-[10pt]">
          {record.folio && (
            <>
              Folio <strong>{record.folio}</strong> ·{" "}
            </>
          )}
          {dateFmt.format(new Date(record.completedAt))} · Examen {TIPOS[record.examType]} · Nivel {nivelDe(record)}
        </p>
        <p className="text-[10pt]">
          Calificación {formatScore(record.score)} / {formatScore(record.maxScore)} · Aciertos {correctas} de {record.totalQuestions} (
          {pct(correctas, record.totalQuestions)} %) · Tiempo {formatClock(record.timeSpentSeconds)} de {formatClock(record.timeLimitSeconds)}
        </p>
      </header>

      {kind === "resumen" ? (
        <table className="w-full border-collapse text-[10pt]">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1">Materia</th>
              <th className="py-1 text-right">Aciertos</th>
              <th className="py-1 text-right">% aciertos</th>
              <th className="py-1 text-right">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {record.materias.map((m) => (
              <tr key={m.materia_clave} className="border-b border-neutral-300">
                <td className="py-1">{m.materia}</td>
                <td className="py-1 text-right">
                  {m.correctas}/{m.total}
                </td>
                <td className="py-1 text-right">{m.porcentaje_aciertos} %</td>
                <td className="py-1 text-right">
                  {formatScore(m.puntos)}/{formatScore(m.maximo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : fallas.length === 0 ? (
        <p>Sin fallas en este examen: ¡respondiste todo correctamente!</p>
      ) : (
        materias.map((materia) => (
          <section key={materia} className="mb-4">
            <h2 className="mb-2 border-b border-neutral-400 text-[13pt] font-bold" style={{ color: "black" }}>
              {materia}
            </h2>
            {fallas
              .filter(({ q }) => q.materia === materia)
              .map(({ q, n }) => (
                <GuideItem key={q.id_original} q={q} n={n} />
              ))}
          </section>
        ))
      )}

      <p className="mt-6 border-t border-neutral-400 pt-2 text-[8pt] text-neutral-600">
        {BRAND.name} es una herramienta independiente de entrenamiento. Este simulacro es un diagnóstico de práctica: no representa una
        evaluación oficial ni garantiza la admisión a ninguna institución.
      </p>
    </div>
  );
}

/** En la guía importa el diagnóstico y la solución, no el error en sí. */
function GuideItem({ q, n }: { q: SnapshotQuestion; n: number }) {
  const options = orderedOptions(q);
  const ci = options.findIndex((r) => r.ponderacion === 1);
  return (
    <article className="mb-3 break-inside-avoid rounded border border-neutral-300 p-3">
      <p className="text-[9pt] text-neutral-600">
        Pregunta {n} · {q.id_original}
      </p>
      <MathText text={q.pregunta} className="block font-semibold" />
      {ci >= 0 && (
        <p className="mt-1">
          <strong>Respuesta correcta:</strong> {letterAt(ci)}) <MathText text={options[ci].texto} />
        </p>
      )}
      {q.diagnostico_error && (
        <p className="mt-1">
          <strong>Diagnóstico:</strong> <MathText text={q.diagnostico_error} />
        </p>
      )}
      {q.solucion_paso_a_paso.length > 0 && (
        <>
          <p className="mt-1 font-semibold">Solución paso a paso</p>
          <ol className="list-decimal pl-5">
            {q.solucion_paso_a_paso.map((paso, i) => (
              <li key={i}>
                <MathText text={paso} />
              </li>
            ))}
          </ol>
        </>
      )}
    </article>
  );
}
