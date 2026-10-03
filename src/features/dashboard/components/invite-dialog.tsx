"use client";

import * as React from "react";
import { CircleAlert, RefreshCw, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShareInvite } from "@/features/invitacion";

import { TUTOR_COPY } from "../lib/tutor-plans";
import { errorMessage, getInviteLink } from "../services/tutor-service";
import { useTutor } from "./tutor-context";

/** "+ Invitar Estudiante": el enlace único del tutor, para compartirlo por WhatsApp, correo o el menú del sistema. */
export function InviteButton({ disabled, variant = "brand" }: { disabled?: boolean; variant?: "brand" | "outline" }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={disabled}>
        <UserPlus /> Invitar Estudiante
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">{open && <InviteBody />}</DialogContent>
      </Dialog>
    </>
  );
}

function InviteBody() {
  const { kind, panel } = useTutor();
  const [link, setLink] = React.useState<{ code: string; url: string } | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "renewing" | "error">("loading");
  const [error, setError] = React.useState("");
  const license = panel?.license;
  const free = license ? Math.max(license.seats - license.used, 0) : 0;

  const load = React.useCallback(async (renew: boolean) => {
    setStatus(renew ? "renewing" : "loading");
    try {
      setLink(await getInviteLink(renew));
      setStatus("ready");
    } catch (e) {
      setError(errorMessage(e, "No pudimos generar el enlace."));
      setStatus("error");
    }
  }, []);

  React.useEffect(() => {
    load(false);
  }, [load]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Invitar a {TUTOR_COPY[kind].students}</DialogTitle>
        <DialogDescription>
          Comparte este enlace. Cada estudiante que se registre con él queda vinculado a tu panel
          {license?.active ? " y ocupa un cupo libre de tu plan." : "."}
        </DialogDescription>
      </DialogHeader>

      {license?.active ? (
        <p className="rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm text-cool">
          Te {free === 1 ? "queda" : "quedan"} <strong className="text-foreground">{free}</strong> de {license.seats}{" "}
          {license.seats === 1 ? "cupo" : "cupos"}.
          {free === 0 && " Quien se registre quedará inactivo hasta que liberes un cupo o amplíes tu plan."}
        </p>
      ) : (
        <p className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-sm text-cool">
          Aún no tienes un plan activo: tus estudiantes se vincularán en modo inactivo hasta que actives uno.
        </p>
      )}

      {status === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" /> {error}
          </p>
          <Button variant="outline" size="sm" onClick={() => load(false)}>
            Reintentar
          </Button>
        </div>
      ) : (
        <ShareInvite link={link} busy={status !== "ready"} />
      )}

      <button
        type="button"
        onClick={() => load(true)}
        disabled={status !== "ready"}
        className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground underline-offset-4 hover:text-cool hover:underline disabled:opacity-50"
      >
        <RefreshCw className="size-3.5" aria-hidden /> Generar un enlace nuevo (el anterior deja de funcionar)
      </button>
    </>
  );
}
