"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Link2, Mail, Send, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useRegistration } from "../../context/registration-context";
import { formatMxn, PLANS } from "../../data/plans";
import * as service from "../../services/registration-service";
import { FormField, invalidClass } from "../form-field";
import { StepHeader } from "../step-header";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Paso 4B: enlace único para vincular al estudiante con la licencia del padre. */
export function InviteStep() {
  const { state, dispatch } = useRegistration();
  const invite = state.createdInvite;
  const [copied, setCopied] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [emailTouched, setEmailTouched] = React.useState(false);
  const [sendState, setSendState] = React.useState<"idle" | "sending" | "sent">("idle");

  if (!invite) return null;

  const emailError = emailTouched && !EMAIL_RE.test(email.trim()) ? "Revisa el correo de tu hijo/a." : undefined;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.url);
    } catch {
      // Sin permiso de portapapeles: se selecciona el texto para copiarlo a mano.
      (document.getElementById("invite-url") as HTMLInputElement | null)?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEmailTouched(true);
    if (!EMAIL_RE.test(email.trim())) return;
    setSendState("sending");
    await service.sendInviteEmail(invite.code, email.trim());
    setSendState("sent");
  };

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Invita a tu hijo/a"
        description="Cuando se registre con este enlace entrará directo a su panel, con la licencia que tú activaste."
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="invite-url" className="flex items-center gap-2 text-sm font-medium text-cool">
          <Link2 className="size-4 text-brand-light" aria-hidden /> Enlace de invitación
        </label>
        <div className="flex gap-2">
          <Input id="invite-url" readOnly value={invite.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs md:text-xs" />
          <Button type="button" variant={copied ? "secondary" : "outline"} onClick={copy} className="h-11 shrink-0" aria-live="polite">
            {copied ? <Check /> : <Copy />}
            {copied ? "¡Copiado!" : "Copiar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Código: <span className="font-mono font-semibold tracking-wider text-cool">{invite.code}</span>
        </p>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" /> o envíalo por correo <span className="h-px flex-1 bg-border" />
      </div>

      {sendState === "sent" ? (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm text-cool">
          <Check className="size-4 shrink-0 text-secondary" /> Enviamos la invitación a <strong className="text-foreground">{email.trim()}</strong>.
        </p>
      ) : (
        // Formulario anidado en el DOM del wizard no es válido: se usa un div con onSubmit manual.
        <div className="flex flex-col gap-3">
          <FormField id="invite-email" label="Correo de tu hijo/a" error={emailError}>
            {(a11y) => (
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  {...a11y}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  placeholder="estudiante@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => email && setEmailTouched(true)}
                  onKeyDown={(e) => e.key === "Enter" && send(e)}
                  className={cn("pl-9", invalidClass)}
                />
              </div>
            )}
          </FormField>
          <Button type="button" variant="outline" onClick={send} disabled={sendState === "sending"}>
            <Send /> {sendState === "sending" ? "Enviando…" : "Enviar invitación"}
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={() => dispatch({ type: "checkout", plan: "family-basic" })}
        className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4 text-left transition-colors hover:bg-gold/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Users className="size-5 shrink-0 text-gold" aria-hidden />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold text-foreground">¿Más carreras o más de un estudiante?</span>
          <span className="block text-muted-foreground">
            Paquete Familiar desde {formatMxn(PLANS["family-basic"].priceMxn)}/{PLANS["family-basic"].period}
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-gold" aria-hidden />
      </button>

      <Button asChild size="lg">
        <Link href="/app/dashboard">
          Ir a mi panel <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
