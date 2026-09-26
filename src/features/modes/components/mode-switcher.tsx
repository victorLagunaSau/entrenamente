"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, ChevronDown, Eye } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { MODES, ownMode, switchableModes } from "../modes";
import { useMode } from "./mode-guard";

/** Botón "Modo: X" al inicio de cada home. Solo lo ven los roles con modos que cambiar. */
export function ModeSwitcher({ className }: { className?: string }) {
  const { viewer, mode } = useMode();
  const [open, setOpen] = React.useState(false);
  const modes = switchableModes(viewer.userType);
  if (modes.length === 0) return null;

  const current = MODES[mode];
  const preview = ownMode(viewer.userType) !== mode;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2.5 rounded-full border border-gold/40 bg-gold/10 pr-3 pl-1.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/15 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="grid size-8 place-items-center rounded-full bg-gold/20">
              <current.icon className="size-4" />
            </span>
            <span>
              <span className="font-normal text-gold/80">Modo · </span>
              {current.label}
            </span>
            <ChevronDown className="size-4" />
          </button>
        </DialogTrigger>
        {preview && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Eye className="size-3.5" /> Vista previa con tus datos
          </span>
        )}
      </div>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="size-5 text-gold" /> Cambiar de modo
          </DialogTitle>
          <DialogDescription>Abre el home de cada tipo de usuario tal como lo ve.</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2">
          {modes.map((id) => {
            const item = MODES[id];
            const active = id === mode;
            return (
              <li key={id}>
                <Link
                  href={item.home}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                    active ? "border-gold/50 bg-gold/10" : "hover:border-brand-light/40 hover:bg-accent"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-lg",
                      active ? "bg-gold/20 text-gold" : "bg-primary/15 text-brand-light"
                    )}
                  >
                    <item.icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">Modo {item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  {active && <Check className="size-5 shrink-0 text-gold" aria-label="Modo actual" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
