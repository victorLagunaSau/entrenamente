"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MateriaGroup, QuestionAccordion } from "@/features/exam/components/libre/exam-report";
import { PrintSheet, usePrint } from "@/features/exam/components/libre/report-print";
import type { ExamRecord, SnapshotQuestion } from "@/features/exam/lib/libre";
import { uniThemeVars } from "@/features/exam/lib/uni-theme";

/**
 * Ejemplo de la Guía de errores con los mismos componentes del reporte real (examen-report / report-print)
 * y datos de muestra. Se carga solo al abrir el diálogo de la landing.
 */

type Opcion = [texto: string, ponderacion: number, diagnostico: string | null];

function pregunta(
  id: string,
  materia: string,
  texto: string,
  opciones: Opcion[],
  elegida: number,
  pasos: string[],
  segundos: number
): SnapshotQuestion {
  const respuestas = opciones.map(([t, p, d], i) => ({ id: i + 1, texto: t, ponderacion: p, diagnosticoError: d }));
  const r = respuestas[elegida];
  return {
    id_original: id,
    materia,
    materia_clave: materia.slice(0, 3).toUpperCase(),
    dificultad: "media",
    valor_puntos: 1,
    fuente_detallada: "Ejemplo",
    lectura: null,
    pregunta: texto,
    respuestas,
    orden_opciones: respuestas.map((x) => x.id),
    respuesta_seleccionada_id: r.id,
    ponderacion_obtenida: r.ponderacion,
    diagnostico_error: r.diagnosticoError,
    solucion_paso_a_paso: pasos,
    tiempo_respuesta_segundos: segundos,
  };
}

const PREGUNTAS: SnapshotQuestion[] = [
  pregunta(
    "UNAM-EJ-MAT-001-V01",
    "Matemáticas",
    "Una chamarra cuesta $800 y tiene 25 % de descuento. Al pagar se cobra 16 % de IVA sobre el precio con descuento. ¿Cuánto pagas en total?",
    [
      ["$728", 0.5, "Restaste los porcentajes (25 % − 16 % = 9 %). Los porcentajes sucesivos no se suman ni se restan: se multiplican."],
      ["$696", 1, null],
      ["$600", 0.75, "El descuento está perfecto, pero olvidaste sumar el IVA."],
      ["$200", 0, "Trampa de lectura: calculaste cuánto te ahorras, no cuánto pagas."],
    ],
    0,
    ["Descuento: 800 × 0.75 = 600.", "IVA sobre el precio con descuento: 600 × 1.16 = 696.", "Atajo: 800 × 0.75 × 1.16 = 696."],
    84
  ),
  pregunta(
    "UNAM-EJ-MAT-002-V02",
    "Matemáticas",
    "Si 3x − 7 = 2x + 5, ¿cuál es el valor de x?",
    [
      ["x = −2", 0.25, null],
      ["x = 12", 1, null],
      ["x = 2", 0.5, null],
      ["x = −12", 0.25, null],
    ],
    1,
    ["Pasa las x a un lado: 3x − 2x = 5 + 7.", "x = 12."],
    41
  ),
  pregunta(
    "UNAM-EJ-FIS-001-V01",
    "Física",
    "Un auto pasa de 0 a 20 m/s en 5 segundos con aceleración constante. ¿Cuál es su aceleración?",
    [
      ["4 m/s²", 1, null],
      ["100 m/s²", 0, "Confusión de fórmula: multiplicaste velocidad por tiempo. La aceleración es el cambio de velocidad entre el tiempo."],
      ["0.25 m/s²", 0.25, "Invertiste la división: dividiste tiempo entre velocidad."],
      ["20 m/s²", 0, "Tomaste la velocidad final como aceleración; faltó dividir entre el tiempo."],
    ],
    1,
    ["a = (v final − v inicial) / t.", "a = (20 − 0) / 5 = 4 m/s²."],
    63
  ),
  pregunta(
    "UNAM-EJ-LIT-001-V01",
    "Literatura",
    "¿Qué figura retórica hay en el verso «tus ojos son dos luceros»?",
    [
      ["Metáfora", 1, null],
      ["Símil", 0.5, "Casi: es una comparación, pero el símil usa un nexo («como», «cual»). Aquí se identifica un término con otro directamente."],
      ["Hipérbole", 0.25, "La hipérbole exagera; aquí no hay exageración, sino identificación entre ojos y luceros."],
      ["Personificación", 0, "La personificación da rasgos humanos a algo que no lo es; aquí ocurre lo contrario."],
    ],
    1,
    ["Busca si hay nexo comparativo («como», «cual»): no lo hay.", "Se identifica un término real (ojos) con uno imaginario (luceros): metáfora."],
    37
  ),
  pregunta(
    "UNAM-EJ-LIT-002-V01",
    "Literatura",
    "¿Quién escribió «Pedro Páramo»?",
    [
      ["Juan Rulfo", 1, null],
      ["Carlos Fuentes", 0.25, null],
      ["Octavio Paz", 0, null],
      ["Juan José Arreola", 0.5, null],
    ],
    0,
    ["«Pedro Páramo» (1955) es la novela de Juan Rulfo."],
    12
  ),
];

function resumen(materia: string) {
  const qs = PREGUNTAS.filter((q) => q.materia === materia);
  const correctas = qs.filter((q) => q.ponderacion_obtenida >= 1).length;
  const puntos = qs.reduce((s, q) => s + q.ponderacion_obtenida, 0);
  return {
    materia,
    materia_clave: qs[0].materia_clave,
    total: qs.length,
    correctas,
    parciales: qs.filter((q) => q.ponderacion_obtenida > 0 && q.ponderacion_obtenida < 1).length,
    incorrectas: qs.filter((q) => q.ponderacion_obtenida === 0).length,
    sin_responder: 0,
    puntos,
    maximo: qs.length,
    porcentaje_aciertos: Math.round((100 * correctas) / qs.length),
  };
}

const MATERIAS = [...new Set(PREGUNTAS.map((q) => q.materia))];

const EJEMPLO: ExamRecord = {
  id: 0,
  folio: "EM-EJEM-PLO1",
  examType: "libre",
  pruebaNumero: null,
  universityKey: "UNAM",
  universityName: "Universidad Nacional Autónoma de México",
  careerName: "Ejemplo de Guía de errores",
  level: "media",
  totalQuestions: PREGUNTAS.length,
  answeredQuestions: PREGUNTAS.length,
  score: PREGUNTAS.reduce((s, q) => s + q.ponderacion_obtenida, 0),
  maxScore: PREGUNTAS.length,
  timeLimitSeconds: PREGUNTAS.length * 90,
  timeSpentSeconds: PREGUNTAS.reduce((s, q) => s + q.tiempo_respuesta_segundos, 0),
  timedOut: false,
  completedAt: new Date().toISOString(),
  target: {
    institucion: { id: "unam", clave: "UNAM", nombre: "Universidad Nacional Autónoma de México" },
    carrera: { id: "ejemplo", nombre: "Ejemplo", area: null },
  },
  materias: MATERIAS.map(resumen),
  questions: PREGUNTAS,
};

const FALLAS = PREGUNTAS.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => q.ponderacion_obtenida < 1);

export default function GuideExample() {
  const { kind, print } = usePrint();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    // Mismo tema claro con el color de la UNAM que ve el alumno en su reporte.
    <div style={uniThemeVars("unam") as React.CSSProperties} className="flex flex-col gap-3 rounded-2xl bg-background p-3 text-foreground sm:p-4">
      <div className="flex flex-col items-start gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold text-primary">Guía de errores</p>
          <p className="text-sm text-muted-foreground text-pretty">
            {FALLAS.length} preguntas para repasar en {new Set(FALLAS.map(({ q }) => q.materia)).size} materias.
          </p>
        </div>
        <Button onClick={() => print("guia")} className="w-full shrink-0 sm:w-auto">
          <Download /> Descargar PDF
        </Button>
      </div>

      {/* La primera falla llega abierta y con la solución completa: se entiende de inmediato qué es la guía. */}
      {MATERIAS.map((materia, i) => {
        const list = FALLAS.filter(({ q }) => q.materia === materia);
        return (
          <MateriaGroup key={materia} name={materia} count={list.length} summary={`${list.length} por repasar`} defaultOpen={i === 0}>
            {list.map(({ q, n }, j) => (
              <QuestionAccordion key={q.id_original} q={q} n={n} total={PREGUNTAS.length} expanded={i === 0 && j === 0} />
            ))}
          </MateriaGroup>
        );
      })}

      {mounted &&
        createPortal(
          <div id="guia-ejemplo-print">
            <PrintSheet record={EJEMPLO} kind={kind} />
          </div>,
          document.body
        )}
    </div>
  );
}
