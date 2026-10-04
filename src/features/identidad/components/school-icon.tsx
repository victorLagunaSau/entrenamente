"use client";

import * as React from "react";
import { GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";

import { svgDataUrl, svgProblem } from "../lib/svg";
import { useIdentidad } from "./identidad-provider";

/**
 * Ícono lineal de una institución. El SVG se usa como máscara CSS y se rellena con `color`
 * (cualquier color o degradado), así que nunca entra al DOM ni ejecuta nada.
 * Sin SVG (o con uno no permitido) muestra un birrete genérico.
 */
export function SchoolIcon({
  svgRaw,
  color = "currentColor",
  className,
  label,
}: {
  svgRaw: string | null | undefined;
  /** Color o degradado CSS ("white", "var(--uni-unam)", "linear-gradient(…)"). */
  color?: string;
  className?: string;
  /** Texto para lectores de pantalla; sin él el ícono es decorativo. */
  label?: string;
}) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  if (!svgRaw || svgProblem(svgRaw)) {
    return <GraduationCap className={cn("size-6 shrink-0", className)} style={{ color }} {...a11y} />;
  }
  const mask = svgDataUrl(svgRaw);
  return (
    <span
      {...a11y}
      className={cn("inline-block size-6 shrink-0", className)}
      style={{
        background: color,
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

/** Ícono de una institución por id o clave, tomado de su identidad. */
export function InstitucionIcon({
  id,
  label,
  ...props
}: { id: string } & Omit<React.ComponentProps<typeof SchoolIcon>, "svgRaw">) {
  const identidad = useIdentidad(id);
  return <SchoolIcon svgRaw={identidad?.iconoSvg} label={label ?? identidad?.sigla} {...props} />;
}
