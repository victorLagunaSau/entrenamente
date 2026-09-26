"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, LogIn, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useSubmit } from "../hooks/use-submit";
import { homePathForCurrentUser, safeNext, signInWithPassword } from "../services/login-service";
import { Field, FormError, FormHeader, PasswordField } from "./fields";
import { LoginShell } from "./login-shell";

/** Inicio de sesión con correo y contraseña. Tras entrar va a `?next=` o al panel de su tipo de usuario. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const login = useSubmit(
    (f) => signInWithPassword(String(f.get("email")), String(f.get("password"))),
    async () => router.replace(next ?? (await homePathForCurrentUser()))
  );

  return (
    <LoginShell>
      <FormHeader icon={<LogIn className="size-6 text-brand-light" />} title="Inicia sesión" description="Entra con el correo y la contraseña de tu cuenta." />
      <form onSubmit={login.onSubmit} className="flex flex-col gap-4">
        <Field id="login-email" name="email" label="Correo" type="email" required autoComplete="email" inputMode="email" placeholder="tu@correo.com" />
        <PasswordField
          id="login-password"
          name="password"
          label="Contraseña"
          required
          autoComplete="current-password"
          aside={
            <Link href="/login/recuperar" className="text-sm text-brand-light underline-offset-4 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          }
        />
        <FormError message={login.error} />
        <Button type="submit" size="lg" disabled={login.busy} className="mt-2">
          {login.busy && <Loader2 className="animate-spin" />} Entrar
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" /> ¿Primera vez aquí? <span className="h-px flex-1 bg-border" />
      </div>

      <Link
        href="/registro"
        className="group flex items-center gap-4 rounded-xl border border-secondary/40 bg-secondary/10 p-4 transition-all hover:border-secondary hover:bg-secondary/15 hover:shadow-glow-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
          <UserPlus className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground">No tengo cuenta, quiero registrarme</span>
          <span className="block text-sm text-muted-foreground">Crea tu cuenta gratis y empieza a entrenar hoy.</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-secondary transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
      </Link>
    </LoginShell>
  );
}
