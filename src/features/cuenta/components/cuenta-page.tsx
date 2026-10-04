"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CircleAlert, Settings, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModeGuard, useMode } from "@/features/modes/components/mode-guard";
import { PanelShell } from "@/features/modes/components/panel-shell";
import { homePathFor } from "@/features/modes/modes";

import { ACCOUNT_PATH } from "../lib/paths";
import { USER_TYPE_LABELS } from "../lib/profile";
import { getAuthProviders, getMiCuenta, type MiCuenta } from "../services/cuenta-service";
import { ConfiguracionTab } from "./configuracion-tab";
import { PerfilTab } from "./perfil-tab";
import { UserAvatar } from "./user-avatar";

type Tab = "perfil" | "configuracion";

/** Mi cuenta (todos los tipos de usuario): pestañas Perfil y Configuración; `?tab=configuracion`. */
export function CuentaPanel() {
  return (
    <ModeGuard>
      <PanelShell>
        <React.Suspense fallback={<Skeleton />}>
          <Cuenta />
        </React.Suspense>
      </PanelShell>
    </ModeGuard>
  );
}

function Skeleton() {
  return <div className="h-48 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" aria-label="Cargando tu cuenta" />;
}

const sinceFmt = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });

export type CuentaContext = {
  cuenta: MiCuenta;
  providers: string[];
  /** Vuelve a leer la cuenta y el encabezado (nombre, foto). */
  reload: () => Promise<void>;
};

function Cuenta() {
  const router = useRouter();
  const tab: Tab = useSearchParams().get("tab") === "configuracion" ? "configuracion" : "perfil";
  const { viewer, refreshViewer } = useMode();
  const [cuenta, setCuenta] = React.useState<MiCuenta | null>(null);
  const [providers, setProviders] = React.useState<string[]>([]);
  const [error, setError] = React.useState("");

  const reload = React.useCallback(async () => {
    const [c, p] = await Promise.all([getMiCuenta(), getAuthProviders()]);
    setCuenta(c);
    setProviders(p);
    refreshViewer();
  }, [refreshViewer]);

  React.useEffect(() => {
    Promise.all([getMiCuenta(), getAuthProviders()])
      .then(([c, p]) => {
        setCuenta(c);
        setProviders(p);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const choose = (next: string) =>
    router.replace(next === "configuracion" ? `${ACCOUNT_PATH}?tab=configuracion` : ACCOUNT_PATH, { scroll: false });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="self-start" asChild>
        <Link href={homePathFor(viewer.userType)}>
          <ArrowLeft /> Inicio
        </Link>
      </Button>

      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      ) : !cuenta ? (
        <Skeleton />
      ) : (
        <>
          <section className="flex items-center gap-4 rounded-2xl border bg-card p-5 sm:p-6">
            <UserAvatar avatarUrl={cuenta.avatarUrl} alias={cuenta.alias} className="size-16 text-2xl sm:size-20" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-bold">{cuenta.fullName || cuenta.alias}</h1>
              <p className="truncate text-sm text-muted-foreground">{cuenta.email}</p>
              <p className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-secondary/15 px-2.5 py-1 font-semibold text-secondary">
                  {USER_TYPE_LABELS[cuenta.userType] ?? cuenta.userType}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-cool">
                  Desde {sinceFmt.format(new Date(cuenta.createdAt))}
                </span>
              </p>
            </div>
          </section>

          <Tabs value={tab} onValueChange={choose}>
            <TabsList className="sm:w-fit">
              <TabsTrigger value="perfil" className="sm:px-6">
                <User className="size-4" aria-hidden /> Perfil
              </TabsTrigger>
              <TabsTrigger value="configuracion" className="sm:px-6">
                <Settings className="size-4" aria-hidden /> Configuración
              </TabsTrigger>
            </TabsList>
            <TabsContent value="perfil">
              <PerfilTab cuenta={cuenta} providers={providers} reload={reload} />
            </TabsContent>
            <TabsContent value="configuracion">
              <ConfiguracionTab cuenta={cuenta} providers={providers} reload={reload} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
