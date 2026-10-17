"use client";

import * as React from "react";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { ArrowLeft, CheckCircle2, ChevronDown, Loader2, Mail, Send } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SITE_URL } from "@/lib/site";
import { supabase } from "@/lib/supabase/client";

import { FAQ_GROUPS, TOPICS } from "../content";

/** Soporte: preguntas frecuentes + formulario de contacto. */
export function SoportePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <Logo className="h-9" />
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-light hover:underline">
          <ArrowLeft className="size-4" /> Inicio
        </Link>
      </div>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold text-balance sm:text-4xl">Soporte</h1>
        <p className="leading-relaxed text-cool text-pretty">
          Revisa las preguntas frecuentes. Si no encuentras tu respuesta, escríbenos y te contestamos por correo.
        </p>
      </header>

      <section className="flex flex-col gap-7" aria-label="Preguntas frecuentes">
        {FAQ_GROUPS.map((g) => (
          <div key={g.title} className="flex flex-col gap-2.5">
            <h2 className="text-lg font-semibold">{g.title}</h2>
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/60">
              {g.faqs.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-medium [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-4 pb-4 leading-relaxed text-cool text-pretty">
                    {f.a}
                    {f.q.startsWith("¿Qué planes") && (
                      <>
                        {" "}
                        <Link href="/pricing" className="font-semibold text-brand-light hover:underline">
                          Ver precios
                        </Link>
                      </>
                    )}
                  </p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </section>

      <ContactForm />
    </main>
  );
}

type Status = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string; fallback?: string };

function ContactForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [topic, setTopic] = React.useState<string>(TOPICS[0]);
  const [message, setMessage] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });

  // Con sesión iniciada, prellena el correo.
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const e = data.session?.user.email;
      if (e) setEmail((cur) => cur || e);
    });
  }, []);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setStatus({ kind: "sending" });
    const base = Capacitor.isNativePlatform() ? SITE_URL : "";
    try {
      const res = await fetch(`${base}/api/soporte`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, topic, message, website }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error ?? "No pudimos enviar tu mensaje."), { fallback: body.fallback });
      setStatus({ kind: "sent" });
      setMessage("");
    } catch (err) {
      const e = err as Error & { fallback?: string };
      setStatus({ kind: "error", message: e.message || "No pudimos enviar tu mensaje.", fallback: e.fallback });
    }
  };

  if (status.kind === "sent") {
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-5">
        <CheckCircle2 className="size-6 text-success" aria-hidden />
        <h2 className="text-lg font-semibold">¡Mensaje enviado!</h2>
        <p className="text-cool">Te responderemos a {email} lo antes posible.</p>
        <Button variant="link" className="h-auto px-0" onClick={() => setStatus({ kind: "idle" })}>
          Enviar otro mensaje
        </Button>
      </section>
    );
  }

  const field = "flex flex-col gap-2";
  return (
    <section className="flex flex-col gap-4" aria-labelledby="contacto">
      <div className="flex flex-col gap-1">
        <h2 id="contacto" className="flex items-center gap-2 text-lg font-semibold">
          <Mail className="size-5 text-secondary" aria-hidden /> Contáctanos
        </h2>
        <p className="text-sm text-muted-foreground">¿No encontraste tu respuesta? Escríbenos.</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-border bg-card/60 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label htmlFor="sp-name">Nombre</Label>
            <Input id="sp-name" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={field}>
            <Label htmlFor="sp-email">Correo</Label>
            <Input id="sp-email" type="email" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className={field}>
          <Label htmlFor="sp-topic">Tema</Label>
          <select
            id="sp-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="border-input flex h-11 w-full rounded-md border bg-background/60 px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 md:text-sm"
          >
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className={field}>
          <Label htmlFor="sp-message">Mensaje</Label>
          <textarea
            id="sp-message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="border-input placeholder:text-muted-foreground w-full rounded-md border bg-background/60 px-3 py-2 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 md:text-sm"
            placeholder="Cuéntanos qué pasó o qué necesitas."
          />
        </div>

        {/* Honeypot anti-spam: invisible para personas. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
        />

        {status.kind === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {status.message}
            {status.fallback && (
              <>
                {" "}
                También puedes escribirnos a{" "}
                <a href={`mailto:${status.fallback}`} className="font-semibold underline">
                  {status.fallback}
                </a>
                .
              </>
            )}
          </p>
        )}

        <Button type="submit" variant="brand" disabled={status.kind === "sending"} className="self-start">
          {status.kind === "sending" ? <Loader2 className="animate-spin" /> : <Send />} Enviar mensaje
        </Button>
      </form>
    </section>
  );
}
