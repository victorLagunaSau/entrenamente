"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useSubmit } from "../hooks/use-submit";
import { sendPasswordReset } from "../services/login-service";
import { Field, FormError, FormHeader } from "./fields";
import { LoginShell } from "./login-shell";

/** Envía el enlace de recuperación; el correo regresa a /login/nueva-contrasena. */
export function RecoverForm() {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const recover = useSubmit(
    (f) => sendPasswordReset(String(f.get("email"))),
    () => setSentTo(email.trim())
  );

  return (
    <LoginShell>
      <FormHeader
        icon={<KeyRound className="size-6 text-brand-light" />}
        title="Recupera tu contraseña"
        description="Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una nueva."
      />
      {sentTo && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-md border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm text-cool">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
          <span>
            Si <span className="font-semibold">{sentTo}</span> tiene una cuenta, te llegará el enlace en unos minutos. Revisa también tu carpeta de spam.
          </span>
        </p>
      )}
      <form onSubmit={recover.onSubmit} className="flex flex-col gap-4">
        <Field
          id="rec-email"
          name="email"
          label="Correo"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormError message={recover.error} />
        <Button type="submit" size="lg" disabled={recover.busy} className="mt-2">
          {recover.busy && <Loader2 className="animate-spin" />} {sentTo ? "Reenviar enlace" : "Enviar enlace"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/login">
            <ArrowLeft /> Volver a iniciar sesión
          </Link>
        </Button>
      </form>
    </LoginShell>
  );
}
