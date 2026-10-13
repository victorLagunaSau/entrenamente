"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Brain } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";
import { homePathForCurrentUser } from "@/features/auth/services/auth-service";

/**
 * Sesión en la landing: `undefined` mientras se lee, `null` sin sesión y, con sesión,
 * el panel que le toca al usuario (estudiante o padres/maestros).
 */
export function useLandingSession() {
  const session = useSession();
  const [homePath, setHomePath] = React.useState("/app/student");

  React.useEffect(() => {
    if (session) homePathForCurrentUser().then(setHomePath);
  }, [session]);

  return { loggedIn: session === undefined ? undefined : !!session, homePath };
}

/** Botón con el degradado del logo que lleva al panel del usuario con sesión. */
export function TrainButton({ href, className, size }: { href: string; className?: string; size?: "sm" | "lg" }) {
  return (
    <Button asChild variant="brand" size={size} className={className}>
      <Link href={href}>
        <Brain className={size === "lg" ? "size-5" : undefined} /> Entrenar ahora
      </Link>
    </Button>
  );
}

/** CTA principal del Hero: "Inicia prueba gratis" o, con sesión, "Entrenar ahora". */
export function HeroPrimaryCta() {
  const { loggedIn, homePath } = useLandingSession();
  const className = "h-14 px-8 text-base";

  if (loggedIn) return <TrainButton href={homePath} size="lg" className={className} />;
  return (
    <Button asChild variant="energy" size="lg" className={className}>
      <Link href="/registro">
        Inicia prueba gratis <ArrowRight className="size-5" />
      </Link>
    </Button>
  );
}

/** Nota bajo los CTA del Hero: solo para quien aún no tiene cuenta. */
export function HeroTrialNote() {
  const { loggedIn } = useLandingSession();
  if (loggedIn !== false) return null;
  return <p className="mt-4 text-sm text-muted-foreground">Gratis · Sin tarjeta</p>;
}
