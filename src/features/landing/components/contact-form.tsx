"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "./section-heading";

/*
 * Envío vía Web3Forms (funciona también en el export estático de Capacitor, sin API Route).
 * El correo destino vive en la cuenta de Web3Forms ligada a la access key: nunca aparece en el código ni en pantalla.
 */
const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY;

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (data.get("botcheck")) return; // honeypot anti-spam

    setStatus("sending");
    try {
      if (!WEB3FORMS_KEY) throw new Error("Falta NEXT_PUBLIC_WEB3FORMS_KEY");
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: "Nueva solicitud de informes · Entrena Mente",
          from_name: "Landing Entrena Mente",
          nombre: data.get("name"),
          whatsapp: data.get("whatsapp"),
          mensaje: data.get("message") || "(sin mensaje)",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      form.reset();
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  return (
    <section aria-labelledby="contacto" className="relative isolate py-20 sm:py-28">
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 mx-auto h-80 max-w-3xl rounded-full bg-primary/20 blur-[120px]" />

      <div className="reveal mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <SectionHeading
          id="contacto"
          eyebrow="Informes"
          title="¿Tienes dudas o necesitas información para tu escuela o familia?"
          subtitle="Déjanos tus datos y te enviamos toda la información directamente a tu WhatsApp."
          className="lg:items-start lg:text-left"
        />

        <div className="rounded-3xl border bg-card/80 p-6 shadow-2xl backdrop-blur sm:p-8">
          {status === "success" ? (
            <div role="status" className="flex flex-col items-center gap-4 py-10 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-secondary/15 shadow-glow-secondary">
                <CheckCircle2 className="size-8 text-secondary" />
              </span>
              <p className="font-display text-xl font-semibold text-balance">
                ¡Gracias! En breve nos pondremos en contacto contigo vía WhatsApp.
              </p>
              <Button variant="ghost" onClick={() => setStatus("idle")}>
                Enviar otra consulta
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

              <div className="flex flex-col gap-2">
                <Label htmlFor="contact-name">Nombre Completo</Label>
                <Input id="contact-name" name="name" required autoComplete="name" placeholder="Tu nombre y apellidos" className="h-12" />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="contact-whatsapp">Número de WhatsApp</Label>
                <Input
                  id="contact-whatsapp"
                  name="whatsapp"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  pattern="\+?[\d\s]{10,18}"
                  title="Escribe un número de al menos 10 dígitos"
                  placeholder="55 1234 5678"
                  className="h-12"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="contact-message">
                  Mensaje o Consulta <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={4}
                  placeholder="Cuéntanos qué necesitas"
                  className="min-h-28 w-full rounded-md border border-input bg-background/60 px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 md:text-sm"
                />
              </div>

              {status === "error" && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-300">
                  No pudimos enviar tu solicitud. Inténtalo de nuevo en unos minutos.
                </p>
              )}

              <Button type="submit" variant="energy" size="lg" className="h-14 text-base" disabled={status === "sending"}>
                {status === "sending" ? (
                  <>
                    <Loader2 className="size-5 animate-spin" /> Enviando…
                  </>
                ) : (
                  <>
                    <MessageCircle className="size-5" /> Solicitar Informes por WhatsApp <Send className="size-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
