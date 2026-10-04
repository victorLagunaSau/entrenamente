"use client";

import * as React from "react";
import { Share } from "@capacitor/share";
import { Check, Copy, Link2, Loader2, Mail, MessageCircle, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { INVITE_SUBJECT, INVITE_TEXT, inviteMessage, mailtoHref, whatsappHref } from "../lib/invite-link";

type Props = {
  /** null mientras se genera el enlace. */
  link: { code: string; url: string } | null;
  busy?: boolean;
  /** false: solo los botones (p. ej. en una lista de invitaciones). */
  showLink?: boolean;
};

/**
 * Enlace de invitación + formas de mandarlo desde el teléfono o la cuenta del propio padre:
 * menú de compartir nativo (@capacitor/share: Android, iOS y navegadores con Web Share)
 * y siempre botones directos de WhatsApp y Correo con el mensaje ya escrito.
 */
export function ShareInvite({ link, busy = false, showLink = true }: Props) {
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [copied, setCopied] = React.useState<"link" | "message" | null>(null);
  // En la app siempre hay menú nativo; en la web depende del navegador (Web Share).
  const [canShare, setCanShare] = React.useState(false);
  React.useEffect(() => {
    Share.canShare()
      .then((r) => setCanShare(r.value))
      .catch(() => setCanShare(false));
  }, []);

  const ready = Boolean(link) && !busy;

  const copy = async (what: "link" | "message") => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(what === "link" ? link.url : inviteMessage(link.url));
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2500);
    } catch {
      // Sin permiso de portapapeles: se selecciona el enlace para copiarlo a mano.
      inputRef.current?.select();
    }
  };

  const share = async () => {
    if (!link) return;
    try {
      await Share.share({
        title: INVITE_SUBJECT,
        text: INVITE_TEXT,
        url: link.url,
        dialogTitle: "Compartir invitación",
      });
    } catch (e) {
      // Cerrar el menú no es un error; cualquier otra falla cae a copiar el mensaje.
      const err = e as { name?: string; message?: string };
      if (err?.name !== "AbortError" && !/cancel/i.test(err?.message ?? "")) copy("message");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {showLink && (
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium text-cool">
            <Link2 className="size-4 text-brand-light" aria-hidden /> Enlace de invitación
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                ref={inputRef}
                id={inputId}
                readOnly
                value={link?.url ?? ""}
                placeholder="Generando enlace…"
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs md:text-xs"
              />
              {!ready && (
                <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none" />
              )}
            </div>
            <Button
              type="button"
              variant={copied === "link" ? "secondary" : "outline"}
              onClick={() => copy("link")}
              disabled={!ready}
              className="h-11 shrink-0"
              aria-live="polite"
            >
              {copied === "link" ? <Check /> : <Copy />}
              {copied === "link" ? "¡Copiado!" : "Copiar"}
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
        {canShare ? (
          <Button type="button" size="lg" onClick={share} disabled={!ready}>
            <Share2 /> Compartir invitación
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            variant={copied === "message" ? "secondary" : "default"}
            onClick={() => copy("message")}
            disabled={!ready}
            aria-live="polite"
          >
            {copied === "message" ? <Check /> : <Copy />}
            {copied === "message" ? "¡Mensaje copiado!" : "Copiar mensaje de invitación"}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <ShareLink href={link && ready ? whatsappHref(link.url) : null} external>
            <MessageCircle /> WhatsApp
          </ShareLink>
          <ShareLink href={link && ready ? mailtoHref(link.url) : null}>
            <Mail /> Correo
          </ShareLink>
        </div>
      </div>
    </div>
  );
}

function ShareLink({
  href,
  external,
  children,
}: {
  href: string | null;
  external?: boolean;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <Button type="button" variant="outline" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline">
      <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {children}
      </a>
    </Button>
  );
}
