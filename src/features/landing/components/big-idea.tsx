import { BrainCircuit } from "lucide-react";

/** La gran idea, de lado a lado: el manifiesto del Estado Examen. */
export function BigIdea() {
  return (
    <section aria-labelledby="gran-idea" className="relative isolate overflow-hidden border-y bg-surface-deep py-20 sm:py-28">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-60" />
      <div aria-hidden className="absolute top-1/2 left-1/2 -z-10 h-72 w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-energy/15 blur-[120px]" />

      <div className="reveal mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-energy/40 bg-energy/10 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-energy uppercase">
          <BrainCircuit className="size-3.5" /> Metodología Estado Examen
        </span>
        <h2 id="gran-idea" className="mt-8 font-display leading-[0.98] font-bold tracking-tight text-balance">
          <span className="block text-[clamp(2.25rem,7.5vw,6.5rem)] text-slate-400">No estudies para memorizar.</span>
          <span className="mt-2 block text-[clamp(2.25rem,7.5vw,6.5rem)] text-brand-gradient">
            Entrena para ejecutar bajo presión.
          </span>
        </h2>
        <p className="mt-8 max-w-2xl text-lg text-muted-foreground text-pretty sm:text-xl">
          Saberte las respuestas no basta. El día del examen ganan quienes ya entrenaron con el reloj encima, la
          redacción cambiada y la presión real. Eso es <strong className="font-semibold text-cool">Estado Examen</strong>.
        </p>
      </div>
    </section>
  );
}
