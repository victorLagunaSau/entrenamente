"use client";

import * as React from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field({ id, label, aside, ...props }: { id: string; label: string; aside?: React.ReactNode } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      <Input id={id} {...props} />
    </div>
  );
}

/** Contraseña con botón para mostrarla (sin medidor: eso es del registro). */
export function PasswordField({ id, label, aside, ...props }: { id: string; label: string; aside?: React.ReactNode } & React.ComponentProps<"input">) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      <div className="relative">
        <Input id={id} type={visible ? "text" : "password"} className="pr-12" {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {message}
    </p>
  );
}

export function FormHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-1.5">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-balance">
        {icon} {title}
      </h1>
      {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
    </header>
  );
}
