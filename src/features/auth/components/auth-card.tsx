"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2, LogIn, MailCheck } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  homePathForCurrentUser,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  updatePassword,
  type AuthResult,
} from "../services/auth-service";

type View = "login" | "recover" | "update";

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
      <path fill="#4285F4" d="M21.4 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.3-1.1 2.4-2.3 3.1l3.6 2.8c2.1-2 3.4-4.8 3.4-8.2z" />
      <path fill="#FBBC05" d="M6.3 14.1c-.2-.6-.3-1.3-.3-2.1s.1-1.4.3-2.1L2.6 7.1C1.8 8.6 1.4 10.3 1.4 12s.4 3.4 1.2 4.9l3.7-2.8z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.9-.9 6.6-2.4L15 16.8c-.9.6-2.1 1.1-3.5 1.1-2.7 0-4.9-1.8-5.7-4.2l-3.7 2.8C3.8 19.6 7.6 22 12 22z" />
    </svg>
  );
}

/** Estado de envío de un formulario: evita dobles envíos y guarda el error. */
function useSubmit(action: (form: FormData) => Promise<AuthResult>, onSuccess: () => void | Promise<void>) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await action(new FormData(e.currentTarget));
    if (res.ok) await onSuccess();
    else setError(res.error);
    setBusy(false);
  };

  return { busy, error, setError, onSubmit };
}

/** Login, recuperación y cambio de contraseña. El registro vive en /registro (wizard). */
export function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode");
  const next = params.get("next");
  // /auth?mode=recover abre la recuperación; ?mode=update llega desde el correo de recuperación.
  const [view, setView] = React.useState<View>(mode === "recover" ? "recover" : mode === "update" ? "update" : "login");
  const [resetSent, setResetSent] = React.useState(false);
  const [googleBusy, setGoogleBusy] = React.useState(false);

  const goHome = async () => router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : await homePathForCurrentUser());

  const login = useSubmit((f) => signInWithPassword(String(f.get("email")), String(f.get("password"))), goHome);
  const recover = useSubmit((f) => sendPasswordReset(String(f.get("email"))), () => setResetSent(true));
  const update = useSubmit(async (f) => {
    const password = String(f.get("password"));
    if (password.length < 8) return { ok: false, error: "Usa al menos 8 caracteres." };
    if (password !== String(f.get("confirm"))) return { ok: false, error: "Las contraseñas no coinciden." };
    return updatePassword(password);
  }, goHome);

  const google = async () => {
    setGoogleBusy(true);
    const res = await signInWithGoogle(next ?? undefined);
    // Si todo sale bien el navegador ya se fue a Google; solo se regresa aquí con error.
    if (!res.ok) {
      login.setError(res.error);
      setGoogleBusy(false);
    }
  };

  return (
    <div className="w-full sm:max-w-md sm:rounded-2xl sm:border sm:bg-card sm:p-8 sm:shadow-2xl">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <Logo variant="vertical" className="h-28" priority />
      </div>

      {view === "login" && (
        <div key="login" className="animate-in fade-in-0 motion-reduce:animate-none">
          <h1 className="mb-6 flex items-center gap-2 text-xl font-bold">
            <LogIn className="size-5 text-brand-light" /> Inicia sesión
          </h1>

          <Button type="button" variant="outline" size="lg" className="w-full" onClick={google} disabled={googleBusy}>
            {googleBusy ? <Loader2 className="animate-spin" /> : <GoogleIcon />} Continuar con Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
            <span className="h-px flex-1 bg-border" /> o con tu correo <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={login.onSubmit} className="flex flex-col gap-4">
            <Field id="login-email" name="email" label="Correo" type="email" required autoComplete="email" placeholder="tu@correo.com" />
            <Field id="login-password" name="password" label="Contraseña" type="password" required autoComplete="current-password" />
            <button
              type="button"
              onClick={() => setView("recover")}
              className="self-end text-sm text-brand-light underline-offset-4 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
            <FormError message={login.error} />
            <Button type="submit" size="lg" disabled={login.busy}>
              {login.busy && <Loader2 className="animate-spin" />} Entrar
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿Aún no tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-brand-light underline-offset-4 hover:underline">
              Regístrate gratis
            </Link>
          </p>
        </div>
      )}

      {view === "recover" && (
        <div key="recover" className="animate-in fade-in-0 motion-reduce:animate-none">
          <h1 className="mb-2 flex items-center gap-2 text-xl font-bold">
            <KeyRound className="size-5 text-brand-light" /> Recupera tu contraseña
          </h1>
          {resetSent ? (
            <p role="status" className="mb-6 flex items-start gap-2 text-sm text-muted-foreground">
              <MailCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
              Si el correo tiene una cuenta, te llegará un enlace para restablecerla. Revisa también tu carpeta de spam.
            </p>
          ) : (
            <p className="mb-6 text-sm text-muted-foreground">Te enviaremos un enlace para restablecerla.</p>
          )}
          <form onSubmit={recover.onSubmit} className="flex flex-col gap-4">
            <Field id="rec-email" name="email" label="Correo" type="email" required autoComplete="email" placeholder="tu@correo.com" />
            <FormError message={recover.error} />
            <Button type="submit" size="lg" variant="secondary" disabled={recover.busy}>
              {recover.busy && <Loader2 className="animate-spin" />} {resetSent ? "Reenviar enlace" : "Enviar enlace"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setView("login")}>
              <ArrowLeft /> Volver a iniciar sesión
            </Button>
          </form>
        </div>
      )}

      {view === "update" && (
        <div key="update" className="animate-in fade-in-0 motion-reduce:animate-none">
          <h1 className="mb-6 flex items-center gap-2 text-xl font-bold">
            <KeyRound className="size-5 text-brand-light" /> Elige una nueva contraseña
          </h1>
          <form onSubmit={update.onSubmit} className="flex flex-col gap-4">
            <Field id="new-password" name="password" label="Nueva contraseña" type="password" required minLength={8} autoComplete="new-password" />
            <Field id="new-password-confirm" name="confirm" label="Confirma la contraseña" type="password" required autoComplete="new-password" />
            <FormError message={update.error} />
            <Button type="submit" size="lg" disabled={update.busy}>
              {update.busy && <Loader2 className="animate-spin" />} Guardar y entrar
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
