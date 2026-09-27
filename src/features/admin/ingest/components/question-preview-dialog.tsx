"use client";

import * as React from "react";
import { RotateCcw, Shuffle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExamQuestion } from "@/features/exam/components/exam-question";

import { SECONDS_BY_DIFICULTAD, carreraNombre } from "../lib/catalog";
import { useCatalogo } from "../lib/use-catalogo";
import { getMaterias } from "../services/questions-service";
import type { Pregunta } from "../types";
import { DifficultyBadge } from "./fields";

/** Vista previa de un reactivo con el mismo componente que usa el examen del estudiante. */
export function QuestionPreviewDialog({ question, onClose }: { question: Pregunta | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(question)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-3xl">
        {question && <PreviewBody key={`${question.id}-${question.actualizado}`} q={question} />}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ q }: { q: Pregunta }) {
  const [shuffle, setShuffle] = React.useState(true);
  const [attempt, setAttempt] = React.useState(0);
  const materia = getMaterias().find((m) => m.clave === q.materia)?.nombre ?? q.materia;
  const { catalogo } = useCatalogo();
  const carreras = q.destinos.map((d) => (catalogo ? carreraNombre(catalogo, d) : d));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
          Vista previa <span className="font-mono text-sm text-gold">{q.id}</span>
          <DifficultyBadge value={q.dificultad} />
        </DialogTitle>
        <DialogDescription>
          {q.institucion} · {materia} · {carreras.length > 3 ? `${carreras.length} carreras` : carreras.join(", ") || "sin carreras asignadas"}
        </DialogDescription>
      </DialogHeader>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-cool">
        <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="size-4 accent-[var(--secondary)]" />
        <Shuffle className="size-4 text-muted-foreground" /> Barajar opciones
      </label>

      <ExamQuestion
        key={`${shuffle}-${attempt}`}
        eyebrow={`Simulacro · ${q.institucion}`}
        title={materia}
        reactivo={q}
        seconds={SECONDS_BY_DIFICULTAD[q.dificultad] ?? 90}
        shuffle={shuffle}
        footer={
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setAttempt((a) => a + 1)}>
            <RotateCcw /> Reintentar
          </Button>
        }
      />
      {q.fuenteDetallada && <p className="text-xs text-muted-foreground">Fuente: {q.fuenteDetallada}</p>}
    </>
  );
}
