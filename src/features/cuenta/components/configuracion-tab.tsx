"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellRing,
  Check,
  FileText,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Presentation,
  Repeat,
  Send,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN, sendPasswordReset, signInWithPassword, updatePassword } from "@/features/login/services/login-service";
import { homePathFor } from "@/features/modes/modes";
import { sendTestNotification } from "@/features/notificaciones/services/notificaciones-service";
import { cn } from "@/lib/utils";

import { USER_TYPE_LABELS } from "../lib/profile";
import {
  changeUserType,
  CuentaError,
  deleteMyAccount,
  type NotificationPrefs,
  type NotificationPrefsPatch,
  saveNotificaciones,
  signOutEverywhere,
} from "../services/cuenta-service";
import type { CuentaContext } from "./cuenta-page";
import { Field, FormMessage, Section, selectClass, Toggle } from "./parts";

const message = (e: unknown) => (e instanceof CuentaError ? e.message : "Algo salió mal. Intenta de nuevo.");

export function ConfiguracionTab(ctx: CuentaContext) {
  return (
    <div className="flex flex-col gap-4">
      <NotificacionesSection {...ctx} />
      <SeguridadSection {...ctx} />
      <TipoSection {...ctx} />
      <PrivacidadSection />
      <EliminarSection {...ctx} />
    </div>
  );
}

// ───────────────────────── Notificaciones ─────────────────────────

type Categoria = keyof NotificationPrefs["categorias"];
type Canal = keyof NotificationPrefs["canales"];

const STUDENT_PREFS: { key: Categoria; label: string; description: string }[] = [
  { key: "plan", label: "Examen del día", description: "Te recordamos el examen de tu plan de estudios." },
  { key: "racha", label: "Racha en riesgo", description: "Un aviso antes de que se pierda tu racha diaria." },
  { key: "resultados", label: "Resultados y logros", description: "Cuando subes de nivel o detectamos un tema a reforzar." },
  { key: "contenido", label: "Contenido de tus carreras", description: "Preguntas y guías nuevas para tus metas." },
];
const TUTOR_PREFS: { key: Categoria; label: string; description: string }[] = [
  { key: "tutor_resumen", label: "Resumen semanal", description: "Cómo les fue a tus estudiantes en la semana." },
  { key: "resultados", label: "Resultados de tus estudiantes", description: "Cuando terminan un examen o un plan." },
];
// Dentro de Entrena Mente (campana y avisos flotantes) siempre; push cuando uses la app en tu celular.
const CANALES: { key: Canal; label: string; description: string }[] = [
  { key: "push", label: "Notificaciones push", description: "En la app de Entrena Mente de tu celular." },
];
const SIEMPRE = ["Pagos, recibos y vencimiento de tu plan", "Avisos de tu cuenta", "Vinculación con tu tutor o tus estudiantes"];
const HORAS = ["07:00", "09:00", "12:00", "15:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
const SILENCIO_DESDE = ["20:00", "21:00", "22:00", "23:00", "00:00"];
const SILENCIO_HASTA = ["05:00", "06:00", "07:00", "08:00", "09:00"];
const ZONAS = [
  { id: "America/Mexico_City", label: "Centro de México" },
  { id: "America/Cancun", label: "Quintana Roo" },
  { id: "America/Mazatlan", label: "Pacífico (Sinaloa, Nayarit, BCS)" },
  { id: "America/Hermosillo", label: "Sonora" },
  { id: "America/Tijuana", label: "Baja California" },
  { id: "America/Guatemala", label: "Guatemala" },
  { id: "America/Los_Angeles", label: "EE. UU. Pacífico" },
  { id: "America/Chicago", label: "EE. UU. Centro" },
  { id: "America/New_York", label: "EE. UU. Este" },
];

/** La opción guardada siempre aparece aunque no esté en la lista. */
const withCurrent = (list: string[], current: string) => (list.includes(current) ? list : [current, ...list]);

type DeviceState = "unsupported" | NotificationPermission;

function NotificacionesSection({ cuenta }: CuentaContext) {
  const [prefs, setPrefs] = React.useState(cuenta.notificationPrefs);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [device, setDevice] = React.useState<DeviceState>("default");

  React.useEffect(() => {
    setDevice(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");
  }, []);

  /** `optimistic` = cómo se ve mientras se guarda; `patch` = lo que se manda. */
  const update = async (key: string, optimistic: NotificationPrefs, patch: NotificationPrefsPatch) => {
    const previous = prefs;
    setPrefs(optimistic);
    setSaving(key);
    setError("");
    try {
      setPrefs(await saveNotificaciones(patch));
    } catch (e) {
      setPrefs(previous);
      setError(message(e));
    } finally {
      setSaving(null);
    }
  };
  const setCategoria = (key: Categoria, value: boolean) =>
    update(key, { ...prefs, categorias: { ...prefs.categorias, [key]: value } }, { categorias: { [key]: value } });
  const setCanal = (key: Canal, value: boolean) =>
    update(`canal-${key}`, { ...prefs, canales: { ...prefs.canales, [key]: value } }, { canales: { [key]: value } });
  const setSilencio = (key: "desde" | "hasta", value: string) =>
    update(`silencio-${key}`, { ...prefs, silencio: { ...prefs.silencio, [key]: value } }, { silencio: { [key]: value } });

  const enableDevice = async () => {
    const result = await Notification.requestPermission();
    setDevice(result);
    if (result === "granted") new Notification("¡Listo!", { body: "Así te avisaremos en este dispositivo.", icon: "/favicon/estudiante/android-icon-192x192.png" });
  };

  const [testing, setTesting] = React.useState(false);
  const [testMessage, setTestMessage] = React.useState({ error: "", success: "" });
  const sendTest = async () => {
    setTesting(true);
    setTestMessage({ error: "", success: "" });
    try {
      const sent = await sendTestNotification();
      setTestMessage(
        sent
          ? { error: "", success: "Listo: en un momento lo ves aparecer y en la campana." }
          : { error: "Ya te mandamos uno hace un momento. Intenta en un minuto.", success: "" }
      );
    } catch (e) {
      const code = (e as { code?: string }).code;
      setTestMessage({
        error:
          code === "PGRST202" || code === "42883"
            ? "Falta correr en Supabase la migración 20261027010000_aviso_prueba.sql."
            : "No pudimos mandar el aviso. Intenta de nuevo.",
        success: "",
      });
    } finally {
      setTesting(false);
    }
  };

  const list = cuenta.userType === "student" ? STUDENT_PREFS : TUTOR_PREFS;
  // Promociones solo para mayores de edad (la base tampoco se las manda a menores).
  const adult = cuenta.edad !== null && cuenta.edad >= 18;

  return (
    <Section icon={Bell} title="Notificaciones" description="Elige qué avisos quieres recibir, por dónde y a qué hora.">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/40 p-4">
        <div className="flex items-center gap-3 text-sm">
          <BellRing className="size-5 text-secondary" aria-hidden />
          {device === "granted"
            ? "Avisos activados en este dispositivo."
            : device === "denied"
              ? "Bloqueaste los avisos: actívalos desde los ajustes de tu navegador."
              : device === "unsupported"
                ? "Este dispositivo no admite avisos del navegador."
                : "Activa los avisos en este dispositivo."}
        </div>
        {device === "default" && (
          <Button variant="outline" size="sm" onClick={enableDevice}>
            <Bell /> Activar
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-background/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-pretty">¿Quieres ver cómo se ve un aviso? Mándate uno de prueba.</p>
          <Button variant="outline" size="sm" disabled={testing} onClick={sendTest}>
            {testing ? <Loader2 className="animate-spin" /> : <Send />} Enviarme un aviso de prueba
          </Button>
        </div>
        <FormMessage error={testMessage.error} success={testMessage.success} />
      </div>

      <PrefGroup title="En tu celular">
        {CANALES.map((c) => (
          <Toggle
            key={c.key}
            id={`canal-${c.key}`}
            label={c.label}
            description={c.description}
            checked={prefs.canales[c.key]}
            disabled={saving === `canal-${c.key}`}
            onChange={(v) => setCanal(c.key, v)}
          />
        ))}
      </PrefGroup>

      <PrefGroup title="Qué te avisamos">
        {list.map((p) => (
          <Toggle
            key={p.key}
            id={`pref-${p.key}`}
            label={p.label}
            description={p.description}
            checked={prefs.categorias[p.key]}
            disabled={saving === p.key}
            onChange={(v) => setCategoria(p.key, v)}
          />
        ))}
        <Toggle
          id="pref-marketing"
          label="Novedades y promociones"
          description={
            adult
              ? "Funciones nuevas y descuentos. Puedes apagarlo cuando quieras."
              : cuenta.edad === null
                ? "Agrega tu fecha de nacimiento en Perfil para elegir si las recibes."
                : "Solo para mayores de 18 años."
          }
          checked={adult && prefs.categorias.marketing}
          disabled={!adult || saving === "marketing"}
          onChange={(v) => setCategoria("marketing", v)}
        />
      </PrefGroup>

      <div className="rounded-xl border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Lock className="size-4 text-muted-foreground" aria-hidden /> Siempre activos
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
          {SIEMPRE.map((s) => (
            <li key={s}>· {s}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground text-pretty">
          Son avisos importantes: te llegan aunque apagues los demás.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hora de los recordatorios" htmlFor="pref-hora">
          <select
            id="pref-hora"
            value={prefs.hora}
            disabled={saving === "hora"}
            onChange={(e) => update("hora", { ...prefs, hora: e.target.value }, { hora: e.target.value })}
            className={selectClass}
          >
            {withCurrent(HORAS, prefs.hora).map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </Field>
        <Field label="Zona horaria" htmlFor="pref-zona">
          <select
            id="pref-zona"
            value={prefs.zona}
            disabled={saving === "zona"}
            onChange={(e) => update("zona", { ...prefs, zona: e.target.value }, { zona: e.target.value })}
            className={selectClass}
          >
            {(ZONAS.some((z) => z.id === prefs.zona) ? ZONAS : [{ id: prefs.zona, label: prefs.zona }, ...ZONAS]).map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sin avisos desde" htmlFor="pref-silencio-desde">
          <select
            id="pref-silencio-desde"
            value={prefs.silencio.desde}
            disabled={saving === "silencio-desde"}
            onChange={(e) => setSilencio("desde", e.target.value)}
            className={selectClass}
          >
            {withCurrent(SILENCIO_DESDE, prefs.silencio.desde).map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hasta" htmlFor="pref-silencio-hasta">
          <select
            id="pref-silencio-hasta"
            value={prefs.silencio.hasta}
            disabled={saving === "silencio-hasta"}
            onChange={(e) => setSilencio("hasta", e.target.value)}
            className={selectClass}
          >
            {withCurrent(SILENCIO_HASTA, prefs.silencio.hasta).map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </Field>
      </div>
      <FormMessage error={error} />
    </Section>
  );
}

function PrefGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="divide-y">{children}</div>
    </div>
  );
}

// ───────────────────────── Seguridad ─────────────────────────

function SeguridadSection({ cuenta, providers }: CuentaContext) {
  const router = useRouter();
  const hasPassword = providers.includes("email");
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [leaving, setLeaving] = React.useState(false);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      if (hasPassword) {
        // Confirma que es la persona dueña de la sesión antes de cambiarla.
        const check = await signInWithPassword(cuenta.email, current);
        if (!check.ok) return setError("Tu contraseña actual no es correcta.");
      }
      const result = await updatePassword(next, confirm);
      if (!result.ok) return setError(result.error);
      setCurrent("");
      setNext("");
      setConfirm("");
      setSuccess(hasPassword ? "Contraseña actualizada." : "Listo: ya puedes entrar también con tu correo y esta contraseña.");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setError("");
    const result = await sendPasswordReset(cuenta.email);
    if (result.ok) setSuccess(`Te enviamos un enlace a ${cuenta.email} para crear una nueva contraseña.`);
    else setError(result.error);
  };

  const logoutAll = async () => {
    setLeaving(true);
    try {
      await signOutEverywhere();
      router.replace("/login");
    } catch (e) {
      setError(message(e));
      setLeaving(false);
    }
  };

  return (
    <Section
      icon={KeyRound}
      title={hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
      description={
        hasPassword
          ? `Usa al menos ${PASSWORD_MIN} caracteres; mejor si mezclas letras y números.`
          : "Entras con Google. Si quieres, crea una contraseña para entrar también con tu correo."
      }
    >
      <form onSubmit={change} className="grid gap-4 sm:grid-cols-2">
        {hasPassword && (
          <Field label="Contraseña actual" htmlFor="pw-current" className="sm:col-span-2">
            <Input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </Field>
        )}
        <Field label="Nueva contraseña" htmlFor="pw-new">
          <Input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={PASSWORD_MIN} autoComplete="new-password" />
        </Field>
        <Field label="Confírmala" htmlFor="pw-confirm">
          <Input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={PASSWORD_MIN} autoComplete="new-password" />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" variant="brand" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />} {hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
          </Button>
          {hasPassword && (
            <Button type="button" variant="link" size="sm" onClick={reset}>
              Olvidé mi contraseña
            </Button>
          )}
        </div>
        <div className="sm:col-span-2">
          <FormMessage error={error} success={success} />
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground text-pretty">¿Entraste en un celular o computadora prestada? Cierra todas tus sesiones.</p>
        <Button variant="outline" size="sm" disabled={leaving} onClick={logoutAll}>
          {leaving ? <Loader2 className="animate-spin" /> : <LogOut />} Cerrar sesión en todos lados
        </Button>
      </div>
    </Section>
  );
}

// ───────────────────────── Tipo de perfil ─────────────────────────

type TypeOption = { id: "student" | "parent" | "teacher"; icon: LucideIcon; label: string; description: string; soon?: boolean };

const TYPE_OPTIONS: TypeOption[] = [
  { id: "student", icon: GraduationCap, label: "Estudiante", description: "Me preparo para mi examen de admisión." },
  { id: "parent", icon: Users, label: "Padre / Tutor", description: "Acompaño y doy seguimiento a mis hijos." },
  { id: "teacher", icon: Presentation, label: "Maestro", description: "Grupos y reportes para mi salón.", soon: true },
];

function TipoSection({ cuenta }: CuentaContext) {
  const [target, setTarget] = React.useState<"student" | "parent" | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  if (cuenta.userType !== "student" && cuenta.userType !== "parent") {
    return (
      <Section icon={Repeat} title="Tipo de perfil">
        <p className="text-sm text-muted-foreground">
          Tu perfil es <strong className="text-foreground">{USER_TYPE_LABELS[cuenta.userType]}</strong>; lo asigna el equipo de Entrena
          Mente.
        </p>
      </Section>
    );
  }

  const convert = async () => {
    if (!target) return;
    setSaving(true);
    setError("");
    try {
      await changeUserType(target);
      // Recarga completa: el modo, los guardas y el home dependen del tipo.
      window.location.assign(homePathFor(target));
    } catch (e) {
      setError(message(e));
      setSaving(false);
    }
  };

  return (
    <Section icon={Repeat} title="Tipo de perfil" description="¿Te registraste con el perfil equivocado? Cámbialo aquí.">
      <div className="grid gap-3 sm:grid-cols-3">
        {TYPE_OPTIONS.map((o) => {
          const current = o.id === cuenta.userType;
          return (
            <button
              key={o.id}
              type="button"
              disabled={current || o.soon}
              onClick={() => o.id !== "teacher" && setTarget(o.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                current ? "border-secondary/60 bg-secondary/10" : "hover:bg-accent disabled:hover:bg-transparent",
                o.soon && "opacity-60"
              )}
            >
              <o.icon className={cn("size-5", current ? "text-secondary" : "text-brand-light")} aria-hidden />
              <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
                {o.label}
                {current && <span className="text-xs font-medium text-secondary">Actual</span>}
                {o.soon && <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">Pronto</span>}
              </span>
              <span className="text-xs text-muted-foreground text-pretty">{o.description}</span>
            </button>
          );
        })}
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cambiar a {target ? USER_TYPE_LABELS[target] : ""}?</DialogTitle>
            <DialogDescription>
              {target === "parent"
                ? "Tu inicio será el panel de Padre / Tutor para invitar y acompañar a tus estudiantes. Tus exámenes, carreras y guías se guardan: si vuelves a ser estudiante, los recuperas."
                : "Tu inicio será el de Estudiante para entrenar tus exámenes. Necesitas no tener estudiantes vinculados ni un plan de tutor activo."}
            </DialogDescription>
          </DialogHeader>
          <FormMessage error={error} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button variant="brand" disabled={saving} onClick={convert}>
              {saving ? <Loader2 className="animate-spin" /> : <Repeat />} Cambiar perfil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

// ───────────────────────── Privacidad ─────────────────────────

function PrivacidadSection() {
  const links = [
    { href: "/legal/privacidad", label: "Aviso de privacidad" },
    { href: "/legal/terminos", label: "Términos y condiciones" },
  ];
  return (
    <Section icon={FileText} title="Privacidad y legal">
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm font-medium text-brand-light hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ───────────────────────── Eliminar cuenta ─────────────────────────

const CONFIRM_WORD = "ELIMINAR";

function EliminarSection({ cuenta }: CuentaContext) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState("");

  if (cuenta.userType === "admin") return null;

  const remove = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteMyAccount(cuenta.id);
      window.location.assign("/");
    } catch (e) {
      setError(message(e));
      setDeleting(false);
    }
  };

  return (
    <Section
      icon={ShieldAlert}
      tone="danger"
      title="Eliminar mi cuenta"
      description="Borra para siempre tu perfil, exámenes, guías, planes y rachas. No se puede deshacer."
    >
      <Button
        variant="outline"
        size="sm"
        className="self-start border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          setTyped("");
          setError("");
          setOpen(true);
        }}
      >
        <Trash2 /> Eliminar mi cuenta
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar tu cuenta para siempre?</DialogTitle>
            <DialogDescription>
              Se borran tu perfil, tus exámenes, guías de errores, planes, rachas y fotos. Si pagas un plan, cancélalo antes para que no
              se cobre de nuevo. Escribe <strong className="text-foreground">{CONFIRM_WORD}</strong> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={`Escribe ${CONFIRM_WORD}`} autoComplete="off" />
          <FormMessage error={error} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={typed.trim().toUpperCase() !== CONFIRM_WORD || deleting}
              onClick={remove}
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Eliminar para siempre
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
