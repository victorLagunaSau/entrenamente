"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, LogIn } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

// Formularios solo visuales: el envío se conectará al backend de autenticación.
const noop = (e: React.FormEvent) => e.preventDefault();

/** Login y recuperación de contraseña. El registro vive en /registro (wizard). */
export function AuthCard() {
  // /auth?mode=recover abre directo la recuperación.
  const initialView = useSearchParams().get("mode") === "recover" ? "recover" : "login";
  const [view, setView] = React.useState<"login" | "recover">(initialView);

  return (
    <div className="w-full sm:max-w-md sm:rounded-2xl sm:border sm:bg-card sm:p-8 sm:shadow-2xl">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <Logo variant="vertical" className="h-28" priority />
      </div>

      {view === "login" ? (
        <div key="login" className="animate-in fade-in-0 motion-reduce:animate-none">
          <h1 className="mb-6 flex items-center gap-2 text-xl font-bold">
            <LogIn className="size-5 text-brand-light" /> Inicia sesión
          </h1>
          <form onSubmit={noop} className="flex flex-col gap-4">
            <Field id="login-email" label="Correo" type="email" autoComplete="email" placeholder="tu@correo.com" />
            <Field id="login-password" label="Contraseña" type="password" autoComplete="current-password" />
            <button
              type="button"
              onClick={() => setView("recover")}
              className="self-end text-sm text-brand-light underline-offset-4 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
            <Button type="submit" size="lg">
              Entrar
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿Aún no tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-brand-light underline-offset-4 hover:underline">
              Regístrate gratis
            </Link>
          </p>
        </div>
      ) : (
        <div key="recover" className="animate-in fade-in-0 motion-reduce:animate-none">
          <h1 className="mb-2 flex items-center gap-2 text-xl font-bold">
            <KeyRound className="size-5 text-brand-light" /> Recupera tu contraseña
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">Te enviaremos un enlace para restablecerla.</p>
          <form onSubmit={noop} className="flex flex-col gap-4">
            <Field id="rec-email" label="Correo" type="email" autoComplete="email" placeholder="tu@correo.com" />
            <Button type="submit" size="lg" variant="secondary">
              Enviar enlace
            </Button>
            <Button type="button" variant="ghost" onClick={() => setView("login")}>
              <ArrowLeft /> Volver a iniciar sesión
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
