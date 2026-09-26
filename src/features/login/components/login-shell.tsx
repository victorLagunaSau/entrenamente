"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChartLine, Clock3, Flame, Loader2 } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { supabase } from "@/lib/supabase/client";

import { homePathForCurrentUser } from "../services/login-service";

const BENEFITS = [
  { icon: Clock3, text: "Retoma tus simulacros donde los dejaste" },
  { icon: Flame, text: "No pierdas tu racha de hoy" },
  { icon: ChartLine, text: "Revisa tu avance por materia" },
];

/**
 * Marco de las pantallas de login: panel de marca + tarjeta (dos columnas en escritorio).
 * Con `redirectIfSignedIn`, una sesión abierta se va directo a su panel (igual que /registro).
 */
export function LoginShell({ children, redirectIfSignedIn = true }: { children: React.ReactNode; redirectIfSignedIn?: boolean }) {
  const router = useRouter();
  const [checking, setChecking] = React.useState(redirectIfSignedIn);

  React.useEffect(() => {
    if (!redirectIfSignedIn) return;
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) router.replace(await homePathForCurrentUser());
      else setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [redirectIfSignedIn, router]);

  if (checking) {
    return (
      <div className="grid flex-1 place-items-center" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
      <aside className="flex flex-col items-center gap-8 text-center lg:items-start lg:text-left">
        <Logo variant="vertical" className="mb-2 h-44 sm:h-52 lg:hidden" priority />
        <Logo variant="full" className="hidden h-32 lg:block xl:h-40" priority />
        <div className="hidden flex-col gap-8 lg:flex">
          <div className="flex flex-col gap-4">
            <h2 className="max-w-lg text-4xl leading-tight font-bold text-balance xl:text-5xl xl:leading-[1.1]">
              Qué bueno verte de nuevo. <span className="text-brand-gradient">Sigamos entrenando</span>.
            </h2>
            <p className="max-w-md text-lg text-muted-foreground text-pretty">
              Cada simulacro cuenta. Entra y continúa tu preparación para el examen de admisión.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-cool">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-secondary/20 bg-secondary/10 text-secondary">
                  <Icon className="size-5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="w-full sm:mx-auto sm:max-w-md lg:max-w-none">
        <div className="w-full animate-in fade-in-0 motion-reduce:animate-none sm:rounded-3xl sm:border sm:bg-card/90 sm:p-8 sm:shadow-2xl sm:backdrop-blur lg:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}
