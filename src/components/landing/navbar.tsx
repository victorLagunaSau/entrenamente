"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled || open ? "border-b bg-background/80 backdrop-blur-xl" : "border-b border-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6">
        <Logo className="h-8 sm:h-10" priority />

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost">
            <a href="#planes">Planes</a>
          </Button>
          <Button asChild variant="outline" className="border-cool/25">
            <Link href="/auth">Iniciar Sesión</Link>
          </Button>
          <Button asChild variant="energy">
            <Link href="/auth?mode=register">Registrarme Gratis</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button asChild variant="energy" size="sm" className="h-9">
            <Link href="/auth?mode=register">Registrarme</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </nav>

      {open && (
        <div className="flex flex-col gap-2 border-t px-4 pt-3 pb-5 md:hidden">
          <Button asChild variant="ghost" size="lg" className="justify-start" onClick={() => setOpen(false)}>
            <a href="#planes">Planes</a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth">Iniciar Sesión</Link>
          </Button>
          <Button asChild variant="energy" size="lg">
            <Link href="/auth?mode=register">Registrarme Gratis</Link>
          </Button>
        </div>
      )}
    </header>
  );
}
