"use client";

import { useRegistration } from "../context/registration-context";
import { STEP_TITLES } from "../lib/steps";

/** "Paso X de Y" + barra de avance. */
export function WizardProgress() {
  const { position, step } = useRegistration();
  const pct = (position.current / position.total) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-cool">
          Paso {position.current} de {position.total}
        </span>
        <span className="text-muted-foreground">{STEP_TITLES[step]}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Avance del registro"
        aria-valuemin={1}
        aria-valuemax={position.total}
        aria-valuenow={position.current}
        aria-valuetext={`Paso ${position.current} de ${position.total}: ${STEP_TITLES[step]}`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-brand-gradient transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
