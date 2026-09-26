"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";

import { useSubmit } from "../hooks/use-submit";
import { homePathForCurrentUser, PASSWORD_MIN, updatePassword } from "../services/login-service";
import { FormError, FormHeader, PasswordField } from "./fields";
import { LoginShell } from "./login-shell";

/** Destino del correo de recuperación: /auth/callback ya abrió la sesión; aquí se elige la nueva contraseña. */
export function UpdatePasswordForm() {
  const router = useRouter();
  const session = useSession();
  const update = useSubmit(
    (f) => updatePassword(String(f.get("password")), String(f.get("confirm"))),
    async () => router.replace(await homePathForCurrentUser())
  );

  return (
    <LoginShell redirectIfSignedIn={false}>
      <FormHeader icon={<KeyRound className="size-6 text-brand-light" />} title="Elige una nueva contraseña" />
      {session === undefined ? (
        <p role="status" className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" aria-label="Cargando" />
        </p>
      ) : session === null ? (
        <div className="flex flex-col gap-4">
          <FormError message="El enlace ya se usó o expiró. Pide uno nuevo." />
          <Button asChild size="lg">
            <Link href="/login/recuperar">Pedir otro enlace</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={update.onSubmit} className="flex flex-col gap-4">
          <PasswordField id="new-password" name="password" label="Nueva contraseña" required minLength={PASSWORD_MIN} autoComplete="new-password" />
          <p className="-mt-2 text-xs text-muted-foreground">Mínimo {PASSWORD_MIN} caracteres.</p>
          <PasswordField id="new-password-confirm" name="confirm" label="Confirma la contraseña" required autoComplete="new-password" />
          <FormError message={update.error} />
          <Button type="submit" size="lg" disabled={update.busy} className="mt-2">
            {update.busy && <Loader2 className="animate-spin" />} Guardar y entrar
          </Button>
        </form>
      )}
    </LoginShell>
  );
}
