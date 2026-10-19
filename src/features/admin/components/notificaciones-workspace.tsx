"use client";

import * as React from "react";
import { Bell, CircleAlert, Loader2, Megaphone, Search, Send, Tag, Trash2, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, Textarea } from "@/features/admin/ingest/components/fields";
import {
  AdminNotifError,
  type Audiencia,
  type Campana,
  type Conteo,
  contarAudiencia,
  DESTINOS,
  enviarNotificacion,
  getCampanas,
  type PlanFiltro,
  retirarCampana,
  type TipoEnvio,
  type TipoUsuarioFiltro,
} from "@/features/admin/services/notificaciones-admin-service";
import { formatDay, searchUsers, type UserHit, userTypeLabel } from "@/features/admin/services/users-service";
import { CareerSearch, getCatalogoActivo, useOpcionCarrera } from "@/features/catalogo";
import type { Institucion } from "@/features/escuelas/types";
import { cn } from "@/lib/utils";

import { AdminPageHeader } from "./admin-module";

const messageOf = (e: unknown, fallback: string) => (e instanceof AdminNotifError ? e.message : fallback);

const TITLE_MAX = 150;
const BODY_MAX = 500;
const USERS_MAX = 200;
const OTRA_RUTA = "__otra__";

const TIPOS_USUARIO: { value: TipoUsuarioFiltro; label: string }[] = [
  { value: "student", label: "Estudiantes" },
  { value: "parent", label: "Padres / tutores" },
  { value: "teacher", label: "Maestros" },
];
const PLANES: { value: PlanFiltro; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pro", label: "Pro" },
  { value: "demo", label: "Demo" },
];

type Persona = { id: string; nombre: string; email: string };

/** Redactar y mandar avisos a usuarios específicos o a grupos; historial con lecturas y opción de retirar. */
export function NotificacionesWorkspace() {
  // Mensaje
  const [tipo, setTipo] = React.useState<TipoEnvio>("aviso");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [destino, setDestino] = React.useState("");
  const [otraRuta, setOtraRuta] = React.useState("");
  // Público
  const [modo, setModo] = React.useState<"filtro" | "usuarios">("filtro");
  const [tipos, setTipos] = React.useState<TipoUsuarioFiltro[]>(["student", "parent", "teacher"]);
  const [plan, setPlan] = React.useState<PlanFiltro>("todos");
  const [institucion, setInstitucion] = React.useState("");
  const [carrera, setCarrera] = React.useState<string | null>(null);
  const [personas, setPersonas] = React.useState<Persona[]>([]);
  // Envío
  const [conteo, setConteo] = React.useState<Conteo | null>(null);
  const [contando, setContando] = React.useState(false);
  const [confirmar, setConfirmar] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exito, setExito] = React.useState<string | null>(null);
  // Historial
  const [campanas, setCampanas] = React.useState<Campana[] | null>(null);
  const [historialError, setHistorialError] = React.useState<string | null>(null);

  const [instituciones, setInstituciones] = React.useState<Institucion[]>([]);
  const carreraOpcion = useOpcionCarrera(carrera);

  React.useEffect(() => {
    getCatalogoActivo()
      .then(setInstituciones)
      .catch(() => setInstituciones([]));
  }, []);

  const cargarHistorial = React.useCallback(async () => {
    try {
      setCampanas(await getCampanas());
      setHistorialError(null);
    } catch (e) {
      setHistorialError(messageOf(e, "No pudimos cargar el historial."));
      setCampanas([]);
    }
  }, []);

  React.useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const actionUrl = destino === OTRA_RUTA ? otraRuta.trim() || null : destino || null;

  const audiencia: Audiencia = React.useMemo(
    () =>
      modo === "usuarios"
        ? { modo, ids: personas.map((p) => p.id) }
        : { modo, tipos, plan, institucion: carrera ? null : institucion || null, carrera },
    [modo, personas, tipos, plan, institucion, carrera]
  );

  // Cualquier cambio del público o del tipo invalida el conteo: hay que volver a calcular antes de mandar.
  React.useEffect(() => {
    setConteo(null);
  }, [audiencia, tipo]);

  const resumen = React.useMemo(() => {
    if (modo === "usuarios") {
      return personas.length === 1 ? personas[0].email : `${personas.length} usuarios específicos`;
    }
    const quien =
      tipos.length === 3 ? "Todos los usuarios" : tipos.map((t) => TIPOS_USUARIO.find((x) => x.value === t)?.label).join(" y ");
    const parts = [quien];
    if (plan !== "todos") parts.push(plan === "pro" ? "Pro" : "Demo");
    if (carreraOpcion) parts.push(`meta ${carreraOpcion.carrera.nombre} (${carreraOpcion.institucion.sigla})`);
    else if (institucion) parts.push(`meta ${instituciones.find((i) => i.id === institucion)?.sigla ?? institucion}`);
    return parts.join(" · ");
  }, [modo, personas, tipos, plan, carreraOpcion, institucion, instituciones]);

  const problemas: string[] = [];
  if (title.trim().length < 3) problemas.push("Escribe un título.");
  if (body.trim().length < 3) problemas.push("Escribe el mensaje.");
  if (destino === OTRA_RUTA && !/^\/\S*$/.test(otraRuta.trim())) problemas.push("La ruta debe empezar con /.");
  if (modo === "usuarios" && personas.length === 0) problemas.push("Agrega al menos un usuario.");
  if (modo === "filtro" && tipos.length === 0) problemas.push("Elige al menos un tipo de usuario.");

  const contar = async () => {
    setContando(true);
    setError(null);
    setExito(null);
    try {
      setConteo(await contarAudiencia(audiencia, tipo));
    } catch (e) {
      setError(messageOf(e, "No pudimos calcular el público."));
    } finally {
      setContando(false);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const r = await enviarNotificacion({ tipo, title, body, actionUrl, audiencia, resumen });
      setConfirmar(false);
      setExito(`Listo: le llegó a ${r.enviados.toLocaleString("es-MX")} ${r.enviados === 1 ? "persona" : "personas"}.`);
      setTitle("");
      setBody("");
      setConteo(null);
      await cargarHistorial();
    } catch (e) {
      setConfirmar(false);
      setError(messageOf(e, "No pudimos mandar la notificación."));
    } finally {
      setEnviando(false);
    }
  };

  const destinatarios = conteo ? conteo.alcanzables : 0;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="/admin/notificaciones"
        title="Notificaciones"
        description="Manda avisos a usuarios específicos o a grupos. Les llegan al instante a la campana, con el aviso flotante y, si lo activaron, al celular."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {/* ───── Mensaje ───── */}
          <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">1. Mensaje</h2>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de mensaje">
              <TipoCard
                active={tipo === "aviso"}
                onClick={() => setTipo("aviso")}
                icon={Megaphone}
                label="Aviso"
                description="Le llega a todo el público elegido."
              />
              <TipoCard
                active={tipo === "promocion"}
                onClick={() => setTipo("promocion")}
                icon={Tag}
                label="Promoción"
                description="Solo a mayores de edad que aceptaron promociones."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notif-title">Título</Label>
              <Input
                id="notif-title"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. ¡Nuevas preguntas para UNAM 2027!"
              />
              <Counter n={title.length} max={TITLE_MAX} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notif-body">Mensaje</Label>
              <Textarea
                id="notif-body"
                value={body}
                maxLength={BODY_MAX}
                rows={3}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Lo que verán en la campana. Corto y claro."
              />
              <Counter n={body.length} max={BODY_MAX} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notif-destino">Al tocarlo lleva a</Label>
                <NativeSelect id="notif-destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
                  {DESTINOS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                  <option value={OTRA_RUTA}>Otra ruta…</option>
                </NativeSelect>
              </div>
              {destino === OTRA_RUTA && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="notif-ruta">Ruta</Label>
                  <Input id="notif-ruta" value={otraRuta} onChange={(e) => setOtraRuta(e.target.value)} placeholder="/app/student/guias" />
                </div>
              )}
            </div>
          </section>

          {/* ───── Público ───── */}
          <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">2. ¿A quién?</h2>
            <div className="grid grid-cols-2 gap-1 rounded-xl border bg-background/40 p-1" role="tablist">
              {(
                [
                  ["filtro", "Un grupo"],
                  ["usuarios", "Usuarios específicos"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={modo === value}
                  onClick={() => setModo(value)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    modo === value ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {modo === "filtro" ? (
              <div className="flex flex-col gap-4">
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">Tipo de usuario</legend>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS_USUARIO.map((t) => {
                      const on = tipos.includes(t.value);
                      return (
                        <Chip
                          key={t.value}
                          active={on}
                          onClick={() => setTipos(on ? tipos.filter((x) => x !== t.value) : [...tipos, t.value])}
                        >
                          {t.label}
                        </Chip>
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">Plan</legend>
                  <div className="flex flex-wrap gap-2">
                    {PLANES.map((p) => (
                      <Chip key={p.value} active={plan === p.value} onClick={() => setPlan(p.value)}>
                        {p.label}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="notif-inst">Institución meta</Label>
                    <NativeSelect
                      id="notif-inst"
                      value={carreraOpcion ? carreraOpcion.institucion.id : institucion}
                      disabled={Boolean(carrera)}
                      onChange={(e) => setInstitucion(e.target.value)}
                    >
                      <option value="">Cualquiera</option>
                      {instituciones.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.sigla} · {i.nombre}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="notif-carrera">Carrera meta (opcional)</Label>
                    <CareerSearch id="notif-carrera" value={carrera} onChange={(c) => setCarrera(c?.careerId ?? null)} />
                  </div>
                </div>
                {(institucion || carrera) && (
                  <p className="text-xs text-muted-foreground">La meta solo la tienen los estudiantes: padres y maestros no entran en este filtro.</p>
                )}
              </div>
            ) : (
              <UserPicker personas={personas} onChange={setPersonas} />
            )}
          </section>
        </div>

        {/* ───── Vista previa y envío ───── */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">3. Vista previa</h2>
            <div className="flex items-start gap-3 rounded-2xl border border-brand-light/40 bg-background/60 p-3 shadow-lg">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white" aria-hidden>
                {tipo === "aviso" ? <Megaphone className="size-4" /> : <Tag className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-pretty break-words">{title.trim() || "Título del aviso"}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground text-pretty break-words">
                  {body.trim() || "Aquí va el mensaje que verán en la campana."}
                </span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              <Users className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
              {resumen || "Sin público"}
            </p>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">4. Enviar</h2>
            {problemas.length > 0 ? (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {problemas.map((p) => (
                  <li key={p}>· {p}</li>
                ))}
              </ul>
            ) : conteo ? (
              <div className="rounded-xl border bg-background/40 p-3 text-sm">
                <p>
                  <strong className="text-2xl tabular-nums">{destinatarios.toLocaleString("es-MX")}</strong>{" "}
                  {destinatarios === 1 ? "persona lo recibirá" : "personas lo recibirán"}
                </p>
                {tipo === "promocion" && conteo.total !== conteo.alcanzables && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    De {conteo.total.toLocaleString("es-MX")} en el grupo; el resto son menores de edad o no aceptaron promociones.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Calcula el público para ver a cuántas personas les llegará.</p>
            )}
            {!conteo ? (
              <Button variant="outline" disabled={problemas.length > 0 || contando} onClick={contar}>
                {contando ? <Loader2 className="animate-spin" /> : <Users />} Calcular público
              </Button>
            ) : (
              <Button variant="brand" disabled={problemas.length > 0 || destinatarios === 0} onClick={() => setConfirmar(true)}>
                <Send /> Enviar a {destinatarios.toLocaleString("es-MX")}
              </Button>
            )}
            {error && <ErrorLine text={error} />}
            {exito && <p className="text-sm text-success">{exito}</p>}
          </section>
        </aside>
      </div>

      {/* ───── Historial ───── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Envíos recientes</h2>
        {historialError && <ErrorLine text={historialError} />}
        {campanas === null ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Cargando" />
        ) : campanas.length === 0 ? (
          !historialError && <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Aún no hay envíos.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {campanas.map((c) => (
              <CampanaCard key={c.id} c={c} onRetirada={cargarHistorial} />
            ))}
          </div>
        )}
      </section>

      <Dialog open={confirmar} onOpenChange={(o) => !enviando && setConfirmar(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              ¿Mandar a {destinatarios.toLocaleString("es-MX")} {destinatarios === 1 ? "persona" : "personas"}?
            </DialogTitle>
            <DialogDescription>
              «{title.trim()}» · {resumen}. Les llega al instante. Si te equivocas, puedes retirarlo desde el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={enviando} onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button variant="brand" disabled={enviando} onClick={enviar}>
              {enviando ? <Loader2 className="animate-spin" /> : <Send />} Enviar ahora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────────────────── Usuarios específicos ─────────────────────────

function UserPicker({ personas, onChange }: { personas: Persona[]; onChange: (p: Persona[]) => void }) {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<UserHit[] | null>(null);
  const [buscando, setBuscando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuscando(true);
    setError(null);
    try {
      setHits(await searchUsers(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos buscar.");
    } finally {
      setBuscando(false);
    }
  };

  const elegidos = new Set(personas.map((p) => p.id));
  const agregar = (h: UserHit) => {
    if (elegidos.has(h.id) || personas.length >= USERS_MAX) return;
    onChange([...personas, { id: h.id, nombre: h.full_name || h.alias, email: h.email }]);
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={buscar} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="correo@ejemplo.com, nombre o ID"
          aria-label="Buscar usuario"
        />
        <Button type="submit" variant="outline" disabled={buscando || q.trim().length < 3}>
          {buscando ? <Loader2 className="animate-spin" /> : <Search />} Buscar
        </Button>
      </form>
      {error && <ErrorLine text={error} />}

      {hits !== null && (
        <ul className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-xl border">
          {hits.length === 0 && <li className="p-3 text-sm text-muted-foreground">Sin resultados.</li>}
          {hits.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{h.full_name || h.alias}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {h.email} · {userTypeLabel(h.user_type)}
                </span>
              </span>
              <Button size="sm" variant="outline" disabled={elegidos.has(h.id)} onClick={() => agregar(h)}>
                {elegidos.has(h.id) ? "Agregado" : "Agregar"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {personas.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {personas.length} de {USERS_MAX} como máximo
          </p>
          <div className="flex flex-wrap gap-2">
            {personas.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 rounded-full border bg-background/40 py-1 pr-1 pl-3 text-xs">
                {p.email}
                <button
                  type="button"
                  onClick={() => onChange(personas.filter((x) => x.id !== p.id))}
                  aria-label={`Quitar ${p.email}`}
                  className="grid size-5 place-items-center rounded-full hover:bg-accent"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Historial ─────────────────────────

function CampanaCard({ c, onRetirada }: { c: Campana; onRetirada: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pct = c.destinatarios ? Math.round((c.leidas / c.destinatarios) * 100) : 0;

  const retirar = async () => {
    setBusy(true);
    setError(null);
    try {
      await retirarCampana(c.id);
      setOpen(false);
      onRetirada();
    } catch (e) {
      setError(messageOf(e, "No pudimos retirarlo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-4", c.retirada_at && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium",
                c.tipo === "aviso" ? "bg-primary/15 text-brand-light" : "bg-gold/15 text-gold"
              )}
            >
              {c.tipo === "aviso" ? "Aviso" : "Promoción"}
            </span>
            {formatDay(c.created_at)} · {c.enviado_por}
          </p>
          <h3 className="mt-1 font-semibold text-pretty">{c.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground text-pretty">{c.body}</p>
        </div>
        <Bell className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-xs text-muted-foreground">
        <Users className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
        {c.audiencia_resumen}
        {c.action_url && <> · lleva a {c.action_url}</>}
      </p>
      {c.retirada_at ? (
        <p className="text-xs font-medium text-destructive">Retirado el {formatDay(c.retirada_at)}</p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs">
              <strong className="tabular-nums">{c.leidas.toLocaleString("es-MX")}</strong> de{" "}
              <span className="tabular-nums">{c.destinatarios.toLocaleString("es-MX")}</span> lo leyeron ({pct} %)
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-light" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
            <Trash2 /> Retirar
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Retirar «{c.title}»?</DialogTitle>
            <DialogDescription>Desaparece de la campana de todas las personas que lo recibieron. No se puede deshacer.</DialogDescription>
          </DialogHeader>
          {error && <ErrorLine text={error} />}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={busy}
              onClick={retirar}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Retirar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

// ───────────────────────── Piezas ─────────────────────────

function TipoCard({
  active,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Megaphone;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        active ? "border-brand-light bg-primary/10" : "hover:bg-accent"
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-brand-light" : "text-muted-foreground")} aria-hidden />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground text-pretty">{description}</span>
      </span>
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-brand-light bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={cn("self-end text-[11px] tabular-nums text-muted-foreground", n > max * 0.9 && "text-gold")}>{n}/{max}</span>;
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {text}
    </p>
  );
}
