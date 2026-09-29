"use client";

import * as React from "react";
import { Check, CircleAlert, Copy, Link2, Loader2, MessageCircle, RefreshCw, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BRAND } from "@/lib/brand";

import { TUTOR_COPY } from "../lib/tutor-plans";
import { errorMessage, getInviteLink } from "../services/tutor-service";
import { useTutor } from "./tutor-context";

/** "+ Invitar Estudiante": el enlace único de la licencia, para copiarlo a WhatsApp o correo. */
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
  const [copied, setCopied] = React.useState<"message" | "link" | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const license = panel?.license;
  const free = license ? Math.max(license.seats - license.used, 0) : 0;

  const load = React.useCallback(async (renew: boolean) => {
    setStatus(renew ? "renewing" : "loading");
    setCopied(null);
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

  // El mensaje completo: así llega listo al chat o al correo.
  const message = link
    ? `¡Hola! Te invito a entrenar para tu examen de admisión en ${BRAND.name}. Crea tu cuenta con este enlace: ${link.url}`
    : "";

  // "message" = texto listo para WhatsApp/email; "link" = solo la URL.
  const copy = async (what: "message" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "message" ? message : (link?.url ?? ""));
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2500);
    } catch {
      inputRef.current?.select();
    }
  };

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
        <div className="flex flex-col gap-2">
          <label htmlFor="tutor-invite-url" className="flex items-center gap-2 text-sm font-medium text-cool">
            <Link2 className="size-4 text-brand-light" aria-hidden /> Enlace de invitación
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                ref={inputRef}
                id="tutor-invite-url"
                readOnly
                value={link?.url ?? ""}
                placeholder="Generando enlace…"
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs md:text-xs"
              />
              {status !== "ready" && (
                <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none" />
              )}
            </div>
            <Button
              type="button"
              variant={copied === "link" ? "secondary" : "outline"}
              onClick={() => copy("link")}
              disabled={status !== "ready"}
              className="h-11 shrink-0"
              aria-live="polite"
            >
              {copied === "link" ? <Check /> : <Copy />}
              {copied === "link" ? "¡Copiado!" : "Copiar enlace"}
            </Button>
          </div>
          {link && (
            <p className="text-xs text-muted-foreground">
              Código: <span className="font-mono font-semibold tracking-wider text-cool">{link.code}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button size="lg" variant={copied === "message" ? "secondary" : "default"} onClick={() => copy("message")} disabled={status !== "ready"} aria-live="polite">
          {copied === "message" ? <Check /> : <Copy />}
          {copied === "message" ? "¡Mensaje copiado!" : "Copiar Enlace para WhatsApp/Email"}
        </Button>
        {link && (
          <Button asChild variant="outline">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              <MessageCircle /> Abrir WhatsApp
            </a>
          </Button>
        )}
      </div>

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
