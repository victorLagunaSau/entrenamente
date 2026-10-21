import Link from "next/link";
import type { Metadata } from "next";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página no encontrada", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo variant="vertical" className="h-24" />
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">No encontramos esta página</h1>
        <p className="text-muted-foreground">Puede que el enlace esté incompleto o que la página ya no exista.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">Ir al inicio</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/soporte">Soporte</Link>
        </Button>
      </div>
    </main>
  );
}
