"use client";

import * as React from "react";
import { CheckCircle2, Database, Loader2, Plus, Trash2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { getMaterias, guardarDosificacion } from "../services/questions-service";
import { NativeSelect } from "./fields";

export type DosificacionInicial = {
  por_materia: Record<string, number>;
  metodo: "oficial" | "estimado";
  fuente: string | null;
  total_reactivos_oficial: number | null;
};

type Modo = "reactivos" | "porcentaje";
type Fila = { clave: string; valor: string };

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(",", ".")));

/** Reactivos del examen oficial → % con un decimal que suma exactamente 100.0 (ajusta la materia mayor). */
function aPorcentajes(conteos: Record<string, number>): Record<string, number> {
  const total = Object.values(conteos).reduce((s, n) => s + n, 0);
  if (total <= 0) return {};
  const pct = Object.fromEntries(Object.entries(conteos).map(([k, n]) => [k, round1((n / total) * 100)]));
  const diff = round1(100 - Object.values(pct).reduce((s, n) => s + n, 0));
  if (diff !== 0) {
    const mayor = Object.keys(pct).reduce((a, b) => (pct[b] > pct[a] ? b : a));
    pct[mayor] = round1(pct[mayor] + diff);
  }
  return pct;
}

/**
 * Edita la dosificación (% del examen oficial por materia) de una o varias carreras.
 * Se puede capturar como reactivos del examen oficial (la guía suele decir "Matemáticas: 26 de 120")
 * o directo en porcentaje. Reemplaza la dosificación anterior de esas carreras.
 */
export function DosificacionDialog({
  open,
  onOpenChange,
  titulo,
  carreras,
  inicial,
  banco,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ej. "A4 · Humanidades y de las Artes (37 carreras)". */
  titulo: string;
  carreras: string[];
  inicial: DosificacionInicial | null;
  /** Preguntas por materia en el banco para esas carreras: se proponen y sirven para llenar rápido. */
  banco: Record<string, number>;
  onSaved: () => void;
}) {
  const materias = getMaterias();
  const nombre = (clave: string) => materias.find((m) => m.clave === clave)?.nombre ?? clave;
  const [modo, setModo] = React.useState<Modo>("reactivos");
  const [filas, setFilas] = React.useState<Fila[]>([]);
  const [metodo, setMetodo] = React.useState<"oficial" | "estimado">("oficial");
  const [fuente, setFuente] = React.useState("");
  const [totalOficial, setTotalOficial] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /** Llena con lo que hay en el banco: % = preguntas de la materia ÷ total de preguntas. */
  const llenarDesdeBanco = React.useCallback(() => {
    setModo("reactivos");
    setFilas((fs) => {
      const claves = [...new Set([...fs.map((f) => f.clave), ...Object.keys(banco)])];
      return claves.map((clave) => ({ clave, valor: String(banco[clave] ?? 0) }));
    });
    setMetodo("estimado");
    setFuente((f) => f || "Proporción de preguntas en el banco");
  }, [banco]);

  // Al abrir: parte de la dosificación guardada (en reactivos si se conoce el total oficial);
  // si no hay, se llena con la proporción del banco para no empezar en ceros.
  React.useEffect(() => {
    if (!open) return;
    if (!inicial) {
      setFilas([]);
      setFuente("");
      setTotalOficial("");
      setError(null);
      llenarDesdeBanco();
      return;
    }
    const claves = [...new Set([...Object.keys(inicial?.por_materia ?? {}), ...Object.keys(banco)])];
    const total = inicial?.total_reactivos_oficial ?? null;
    const enReactivos = Boolean(total) || !inicial;
    setModo(enReactivos ? "reactivos" : "porcentaje");
    setFilas(
      claves.map((clave) => {
        const pct = inicial?.por_materia[clave];
        if (pct === undefined) return { clave, valor: "" };
        return { clave, valor: String(enReactivos && total ? Math.round((pct / 100) * total) : pct) };
      })
    );
    setMetodo(inicial?.metodo ?? "oficial");
    setFuente(inicial?.fuente ?? "");
    setTotalOficial(total ? String(total) : "");
    setError(null);
  }, [open, inicial, banco, llenarDesdeBanco]);

  const valores = Object.fromEntries(filas.map((f) => [f.clave, num(f.valor)]));
  const invalidos = filas.filter((f) => !Number.isFinite(num(f.valor)) || num(f.valor) < 0).map((f) => f.clave);
  const totalReactivos = modo === "reactivos" ? Object.values(valores).reduce((s, n) => s + n, 0) : null;
  const pct = modo === "reactivos" ? aPorcentajes(valores) : Object.fromEntries(filas.map((f) => [f.clave, round1(num(f.valor))]));
  const suma = round1(Object.values(pct).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0));
  const enterosMal = modo === "reactivos" && Object.values(valores).some((n) => !Number.isInteger(n));
  // Igual a lo que hay en el banco: no es la estructura del examen oficial.
  const desdeBanco = modo === "reactivos" && filas.length > 0 && filas.every((f) => num(f.valor) === (banco[f.clave] ?? 0));
  const ok = invalidos.length === 0 && !enterosMal && suma === 100 && filas.length > 0;

  const cambiarModo = (m: Modo) => {
    if (m === modo) return;
    setFilas((fs) =>
      fs.map((f) => ({
        ...f,
        valor:
          m === "porcentaje"
            ? f.valor.trim() === "" ? "" : String(pct[f.clave] ?? 0)
            : num(totalOficial) > 0 && f.valor.trim() !== ""
              ? String(Math.round((num(f.valor) / 100) * num(totalOficial)))
              : "",
      }))
    );
    setModo(m);
  };

  const libres = materias.filter((m) => !filas.some((f) => f.clave === m.clave));

  const guardar = async () => {
    setSaving(true);
    setError(null);
    try {
      await guardarDosificacion(carreras, {
        porClave: pct,
        metodo,
        fuente: fuente.trim(),
        totalOficial: desdeBanco ? null : totalReactivos ?? (Number.isInteger(num(totalOficial)) && num(totalOficial) > 0 ? num(totalOficial) : null),
        archivo: "Editada en Inventario",
      });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dosificación del examen</DialogTitle>
          <DialogDescription>
            {titulo}. Usa la estructura del examen oficial (cuántos reactivos trae de cada materia), no cuántas preguntas hay en el banco.
            Reemplaza la dosificación actual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Capturar en:</span>
          {(["reactivos", "porcentaje"] as const).map((m) => (
            <Button key={m} type="button" size="sm" variant={modo === m ? "default" : "outline"} onClick={() => cambiarModo(m)} aria-pressed={modo === m}>
              {m === "reactivos" ? "Reactivos" : "Porcentaje"}
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={llenarDesdeBanco}>
            <Database /> Calcular con el banco
          </Button>
        </div>
        {desdeBanco && (
          <p className="-mt-2 text-xs text-muted-foreground">
            Calculado con las preguntas del banco (cada materia ÷ total). Ajusta los números si la guía oficial dice otra cosa.
          </p>
        )}

        <ul className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto pr-1">
          {filas.map((f, i) => (
            <li key={f.clave} className="grid grid-cols-[minmax(0,1fr)_6rem_4.5rem_2.25rem] items-center gap-2 text-sm">
              <Label htmlFor={`dos-${f.clave}`} className="min-w-0 truncate font-normal">
                {nombre(f.clave)} <span className="font-mono text-xs text-muted-foreground">{f.clave}</span>
              </Label>
              <Input
                id={`dos-${f.clave}`}
                inputMode="decimal"
                value={f.valor}
                placeholder="0"
                aria-invalid={invalidos.includes(f.clave) || undefined}
                onChange={(e) => setFilas((fs) => fs.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                className="h-9 text-right font-mono"
              />
              <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                {modo === "reactivos" ? `${(pct[f.clave] ?? 0).toFixed(1)} %` : "%"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={`Quitar ${nombre(f.clave)}`}
                onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>

        {libres.length > 0 && (
          <div className="flex items-center gap-2">
            <NativeSelect
              aria-label="Agregar materia"
              value=""
              onChange={(e) => e.target.value && setFilas((fs) => [...fs, { clave: e.target.value, valor: "" }])}
              className="h-9 text-sm"
            >
              <option value="">Agregar materia…</option>
              {libres.map((m) => (
                <option key={m.clave} value={m.clave}>
                  {m.nombre}
                </option>
              ))}
            </NativeSelect>
            <Plus className="size-4 text-muted-foreground" />
          </div>
        )}

        {modo === "porcentaje" && (
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="dos-total">Reactivos del examen oficial</Label>
            <Input id="dos-total" inputMode="numeric" value={totalOficial} onChange={(e) => setTotalOficial(e.target.value)} placeholder="120" />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dos-metodo">Método</Label>
            <NativeSelect id="dos-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as "oficial" | "estimado")}>
              <option value="oficial">Oficial (la guía dice cuántos reactivos)</option>
              <option value="estimado">Estimado (por el peso de los temas)</option>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dos-fuente">Fuente</Label>
            <Input id="dos-fuente" value={fuente} onChange={(e) => setFuente(e.target.value)} placeholder="Guía oficial UNAM 2025 Área 4" />
          </div>
        </div>

        <p className={cn("flex items-center gap-1.5 text-sm", ok ? "text-secondary" : "text-gold")} role="status">
          {ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          {modo === "reactivos" && <>{desdeBanco ? `${totalReactivos} preguntas en el banco` : `Examen oficial de ${totalReactivos} reactivos`} · </>}
          Suma {suma.toFixed(1)} %{!ok && (enterosMal ? " · los reactivos deben ser enteros" : suma !== 100 ? " · debe ser 100.0" : "")}
        </p>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={!ok || saving}>
            {saving && <Loader2 className="animate-spin" />} Guardar para {carreras.length} {carreras.length === 1 ? "carrera" : "carreras"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
