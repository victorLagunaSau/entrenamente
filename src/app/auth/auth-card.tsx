"use client";

import { KeyRound, LogIn, UserPlus } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

// Formularios solo visuales: el envío se conectará al backend de autenticación.
const noop = (e: React.FormEvent) => e.preventDefault();

export function AuthCard() {
  return (
    <div className="w-full sm:max-w-md sm:rounded-2xl sm:border sm:bg-card sm:p-8 sm:shadow-2xl">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <Logo tagline />
        <p className="text-sm text-muted-foreground">Espacio de Trabajo: Autenticación</p>
      </div>

      <Tabs defaultValue="login">
        <TabsList>
          <TabsTrigger value="login">
            <LogIn className="size-4" /> Login
          </TabsTrigger>
          <TabsTrigger value="register">
            <UserPlus className="size-4" /> Registro
          </TabsTrigger>
          <TabsTrigger value="recover">
            <KeyRound className="size-4" /> <span className="sm:hidden">Recuperar</span>
            <span className="hidden sm:inline">Recuperación</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={noop} className="flex flex-col gap-4 pt-2">
            <Field id="login-email" label="Correo" type="email" autoComplete="email" placeholder="tu@correo.com" />
            <Field id="login-password" label="Contraseña" type="password" autoComplete="current-password" />
            <Button type="submit" size="lg" className="mt-2">Entrar</Button>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={noop} className="flex flex-col gap-4 pt-2">
            <Field id="reg-name" label="Nombre" autoComplete="name" placeholder="Tu nombre" />
            <Field id="reg-email" label="Correo" type="email" autoComplete="email" placeholder="tu@correo.com" />
            <Field id="reg-password" label="Contraseña" type="password" autoComplete="new-password" />
            <Button type="submit" size="lg" className="mt-2">Crear cuenta</Button>
          </form>
        </TabsContent>

        <TabsContent value="recover">
          <form onSubmit={noop} className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <Field id="rec-email" label="Correo" type="email" autoComplete="email" placeholder="tu@correo.com" />
            <Button type="submit" size="lg" variant="secondary" className="mt-2">Enviar enlace</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
