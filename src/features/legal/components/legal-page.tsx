import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";

import { Logo } from "@/components/layout/logo";

import { LEGAL_UPDATED_AT, type LegalSection } from "../content";

/** Página de lectura para textos legales (aviso de privacidad, términos). */
export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <Logo className="h-9" />
        <Link href="/registro" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-light hover:underline">
          <ArrowLeft className="size-4" /> Volver
        </Link>
      </div>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold text-balance sm:text-4xl">{title}</h1>
        <p className="text-sm text-muted-foreground">Última actualización: {LEGAL_UPDATED_AT}</p>
        <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Texto provisional, pendiente de revisión legal.
        </p>
      </header>

      <div className="flex flex-col gap-7">
        {sections.map((s, i) => (
          <section key={s.title} className="flex flex-col gap-2.5">
            <h2 className="text-lg font-semibold">
              {i + 1}. {s.title}
            </h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="leading-relaxed text-cool text-pretty">
                {p}
              </p>
            ))}
            {s.items && (
              <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed text-cool marker:text-secondary">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
