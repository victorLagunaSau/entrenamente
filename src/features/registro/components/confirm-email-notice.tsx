"use client";

import { MailCheck } from "lucide-react";

import { useRegistration } from "../context/registration-context";

/** Aviso tras crear la cuenta cuando Supabase exige confirmar el correo antes de entrar. */
export function ConfirmEmailNotice() {
  const { state } = useRegistration();
  if (!state.needsEmailConfirmation) return null;

  return (
    <p role="status" className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/5 p-4 text-left text-sm text-cool">
      <MailCheck className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
      <span>
        Te enviamos un correo a <strong className="text-foreground">{state.account.email.trim()}</strong>. Confírmalo para
        poder entrar a tu panel (revisa también spam).
      </span>
    </p>
  );
}
