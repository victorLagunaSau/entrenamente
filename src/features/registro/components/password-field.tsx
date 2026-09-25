"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { passwordStrength, PASSWORD_MIN } from "../lib/validation";
import { invalidClass } from "./form-field";

const BAR_COLORS = ["bg-destructive", "bg-destructive", "bg-gold", "bg-secondary", "bg-secondary"];
const LABEL_COLORS = ["text-destructive", "text-destructive", "text-gold", "text-secondary", "text-secondary"];

export function PasswordInput({
  value,
  onChange,
  onBlur,
  ...a11y
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}) {
  const [visible, setVisible] = React.useState(false);
  const strength = passwordStrength(value);
  const meterId = `${a11y.id}-strength`;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Input
          {...a11y}
          aria-describedby={[a11y["aria-describedby"], meterId].filter(Boolean).join(" ")}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cn("pr-12", invalidClass)}
        />
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

      <div id={meterId} className="flex items-center gap-3" aria-live="polite">
        <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-colors duration-300",
                strength.score >= i ? BAR_COLORS[strength.score] : "bg-muted"
              )}
            />
          ))}
        </div>
        <span className={cn("w-20 text-right text-xs font-medium", value ? LABEL_COLORS[strength.score] : "text-muted-foreground")}>
          {value ? strength.label : `Mín. ${PASSWORD_MIN}`}
          <span className="sr-only"> — seguridad de la contraseña</span>
        </span>
      </div>
    </div>
  );
}
