"use client";

import * as React from "react";
import { CheckCircle2, ChevronDown, CircleDashed, CircleMinus, FileText, Lightbulb, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { LETTERS } from "../lib/player";
import type { SnapshotQuestion } from "../services/toefl-service";
import { SECTION_LABEL, SECTIONS, type Section } from "../types";

type Lang = "es" | "en";
const LANG_KEY = "em.toefl.guideLang";

/** Textos de la guía en los dos idiomas: el conmutador cambia todo, no solo el diagnóstico. */
const T = {
  es: {
    title: "Guía de errores",
    intro: "Revisa por qué fallaste cada pregunta y cómo se resuelve paso a paso.",
    mistakes: "Errores",
    all: "Todas",
    allSections: "Todas las secciones",
    none: "¡Sin errores en esta selección!",
    question: "Pregunta",
    yourAnswer: "Tu respuesta",
    correct: "Respuesta correcta",
    unanswered: "No respondiste esta pregunta.",
    whyWrong: "Por qué es un error",
    partial: "Respuesta parcialmente correcta",
    solution: "Solución paso a paso",
    showSolution: "Ver solución",
    hideSolution: "Ocultar solución",
    context: "Pasaje y transcripción",
    passage: "Pasaje",
    transcript: "Transcripción del audio",
    missing: "Disponible solo en inglés.",
  },
  en: {
    title: "Error Guide",
    intro: "Review why each answer was wrong and how to solve it step by step.",
    mistakes: "Mistakes",
    all: "All",
    allSections: "All sections",
    none: "No mistakes in this selection!",
    question: "Question",
    yourAnswer: "Your answer",
    correct: "Correct answer",
    unanswered: "You did not answer this question.",
    whyWrong: "Why it is wrong",
    partial: "Partially correct answer",
    solution: "Step-by-step solution",
    showSolution: "Show solution",
    hideSolution: "Hide solution",
    context: "Passage and transcript",
    passage: "Passage",
    transcript: "Audio transcript",
    missing: "Only available in Spanish.",
  },
} satisfies Record<Lang, Record<string, string>>;

type Status = "correct" | "partial" | "wrong" | "unanswered";

function statusOf(q: SnapshotQuestion): Status {
  if (q.respuesta_seleccionada_id === null) return "unanswered";
  if (Number(q.ponderacion_obtenida) >= 1) return "correct";
  if (Number(q.ponderacion_obtenida) > 0) return "partial";
  return "wrong";
}

function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

/**
 * <ErrorGuide/>: retroalimentación del intento con el interruptor [ ESPAÑOL | ENGLISH ].
 * Alterna en tiempo real diagnosticoError_es / _en y step_by_step_explanation_es / _en
 * (si falta un idioma, muestra el otro con un aviso). La pregunta y las opciones quedan en inglés, como en el examen.
 */
export function ErrorGuide({ preguntas }: { preguntas: SnapshotQuestion[] }) {
  const [lang, setLangState] = React.useState<Lang>("es");
  const [onlyMistakes, setOnlyMistakes] = React.useState(true);
  const [section, setSection] = React.useState<Section | null>(null);

  React.useEffect(() => setLangState(readLang()), []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  };

  const t = T[lang];
  const numbered = preguntas.map((q, i) => ({ q, n: i + 1, status: statusOf(q) }));
  const mistakes = numbered.filter((x) => x.status !== "correct").length;
  const shown = numbered.filter((x) => (!onlyMistakes || x.status !== "correct") && (!section || x.q.section === section));
  const sections = SECTIONS.filter((s) => preguntas.some((q) => q.section === s));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="toefl-guide" lang={lang}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="toefl-guide" className="text-xl font-bold">
            {t.title}
          </h2>
          <p className="text-sm text-muted-foreground">{t.intro}</p>
        </div>
        <div role="radiogroup" aria-label="Idioma / Language" className="inline-flex rounded-xl border bg-card p-1 text-xs font-semibold tracking-wide">
          {(["es", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={lang === l}
              onClick={() => setLang(l)}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-colors",
                lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l === "es" ? "ESPAÑOL" : "ENGLISH"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Chip active={onlyMistakes} onClick={() => setOnlyMistakes(true)}>
          {t.mistakes} · {mistakes}
        </Chip>
        <Chip active={!onlyMistakes} onClick={() => setOnlyMistakes(false)}>
          {t.all} · {preguntas.length}
        </Chip>
        <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
        <Chip active={section === null} onClick={() => setSection(null)}>
          {t.allSections}
        </Chip>
        {sections.map((s) => (
          <Chip key={s} active={section === s} onClick={() => setSection(s)}>
            {SECTION_LABEL[s]}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border bg-card p-4 text-sm text-secondary">
          <CheckCircle2 className="size-4" /> {t.none}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {shown.map((x) => (
            <GuideItem key={x.q.id_original} q={x.q} n={x.n} status={x.status} lang={lang} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 transition-colors hover:bg-accent",
        active && "border-primary bg-primary/10 text-brand-light"
      )}
    >
      {children}
    </button>
  );
}

const STATUS_ICON: Record<Status, { icon: typeof XCircle; tone: string }> = {
  correct: { icon: CheckCircle2, tone: "text-secondary" },
  partial: { icon: CircleMinus, tone: "text-gold" },
  wrong: { icon: XCircle, tone: "text-destructive" },
  unanswered: { icon: CircleDashed, tone: "text-muted-foreground" },
};

/** Texto en el idioma elegido; si falta, el otro con aviso. */
function pick(lang: Lang, es: string | null | undefined, en: string | null | undefined) {
  const want = lang === "es" ? es : en;
  const other = lang === "es" ? en : es;
  if (want?.trim()) return { text: want, fallback: false };
  if (other?.trim()) return { text: other, fallback: true };
  return null;
}

function GuideItem({ q, n, status, lang }: { q: SnapshotQuestion; n: number; status: Status; lang: Lang }) {
  const t = T[lang];
  const [open, setOpen] = React.useState(false);
  const { icon: Icon, tone } = STATUS_ICON[status];
  const correct = q.respuestas.find((o) => Number(o.ponderacion) >= 1);
  const diag = status === "wrong" || status === "partial" ? pick(lang, q.diagnostico_error_es, q.diagnostico_error_en) : null;
  const stepsWanted = lang === "es" ? q.solucion_es : q.solucion_en;
  const stepsOther = lang === "es" ? q.solucion_en : q.solucion_es;
  const steps = stepsWanted?.length ? stepsWanted : stepsOther ?? [];
  const stepsFallback = !stepsWanted?.length && steps.length > 0;
  const hasContext = Boolean(q.reading_passage || q.transcription);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("size-4", tone)} aria-hidden />
        <span className="font-semibold text-foreground">
          {t.question} {n}
        </span>
        <span>· {SECTION_LABEL[q.section]}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-semibold">{q.mcer_level}</span>
      </div>

      {hasContext && (
        <details className="group rounded-xl border bg-background/40 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 font-medium">
            <FileText className="size-4 text-muted-foreground" /> {t.context}
            <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-3 border-t p-3" lang="en">
            {q.audio_url && <audio controls preload="none" src={q.audio_url} className="w-full" />}
            {q.transcription && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground" lang={lang}>
                  {t.transcript}
                </p>
                <p className="whitespace-pre-line">{q.transcription}</p>
              </div>
            )}
            {q.reading_passage && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground" lang={lang}>
                  {t.passage}
                </p>
                <p className="max-h-72 overflow-y-auto whitespace-pre-line">{q.reading_passage}</p>
              </div>
            )}
          </div>
        </details>
      )}

      <p className="font-semibold whitespace-pre-line" lang="en">
        {q.pregunta}
      </p>

      <ul className="flex flex-col gap-1.5 text-sm" lang="en">
        {q.respuestas.map((o, i) => {
          const chosen = o.id === q.respuesta_seleccionada_id;
          const isCorrect = o.id === correct?.id;
          return (
            <li
              key={o.id}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border px-3 py-2",
                isCorrect && "border-secondary/50 bg-secondary/10",
                chosen && !isCorrect && "border-destructive/50 bg-destructive/10"
              )}
            >
              <span className="font-semibold">{LETTERS[i] ?? o.id}</span>
              <span className="flex-1">{o.texto}</span>
              {(chosen || isCorrect) && (
                <span className={cn("shrink-0 text-xs font-medium", isCorrect ? "text-secondary" : "text-destructive")} lang={lang}>
                  {chosen && isCorrect ? t.correct : chosen ? t.yourAnswer : t.correct}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {status === "unanswered" && <p className="text-sm text-muted-foreground">{t.unanswered}</p>}

      {diag && (
        <div className={cn("rounded-xl border p-3 text-sm", status === "partial" ? "border-gold/40 bg-gold/10" : "border-destructive/30 bg-destructive/5")}>
          <p className="mb-1 font-semibold">{status === "partial" ? t.partial : t.whyWrong}</p>
          <p lang={diag.fallback ? (lang === "es" ? "en" : "es") : lang}>{diag.text}</p>
          {diag.fallback && <p className="mt-1 text-xs text-muted-foreground">{t.missing}</p>}
        </div>
      )}

      {steps.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-light hover:underline"
          >
            <Lightbulb className="size-4" /> {open ? t.hideSolution : t.showSolution}
          </button>
          {open && (
            <div className="rounded-xl bg-muted/40 p-3 text-sm">
              <p className="mb-2 font-semibold">{t.solution}</p>
              <ol className="flex flex-col gap-1.5" lang={stepsFallback ? (lang === "es" ? "en" : "es") : lang}>
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-brand-light">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              {stepsFallback && <p className="mt-2 text-xs text-muted-foreground">{t.missing}</p>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
