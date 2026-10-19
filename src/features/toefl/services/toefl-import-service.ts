/**
 * Importación TOEFL desde el panel: el ZIP se abre en el navegador (no pasa por una ruta de servidor, así no
 * choca con el límite de tamaño de Vercel), los MP3 suben directo al bucket `toefl-audios` con la sesión del
 * admin y al final una sola llamada a `importar_toefl()` guarda assets + preguntas en una transacción.
 *
 * Si la base rechaza el paquete se borran los audios que esta importación creó: no queda nada a medias.
 * Cada audio vive en `<audioKey>/<sha256>.mp3`, así reimportar el mismo MP3 no duplica y uno nuevo no pisa
 * al que todavía usan las preguntas actuales.
 */

import { unzipSync } from "fflate";

import { supabase } from "@/lib/supabase/client";

import { type AssetDraft, type Manifest, manifestList, parseManifest } from "../lib/manifest";
import type { AgeRange, McerLevel, Section, ToeflAssetRow } from "../types";

const BUCKET = "toefl-audios";
export const MAX_ZIP_BYTES = 300 * 1024 * 1024;

export class ToeflImportError extends Error {}

export type Paquete = Manifest & {
  archivo: string;
  /** Archivos del ZIP relativos a la carpeta del manifest. */
  files: Map<string, Uint8Array>;
  audioBytes: number;
};

/** Abre el ZIP, ubica el manifest.json (en la raíz o dentro de una sola carpeta) y lo valida. */
export async function readPaquete(file: File): Promise<Paquete> {
  if (file.size > MAX_ZIP_BYTES) throw new ToeflImportError("El ZIP pesa más de 300 MB.");
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      // Ignora la basura de macOS y solo descomprime lo que se usa.
      filter: (f) => !f.name.startsWith("__MACOSX/") && !/(^|\/)\._/.test(f.name) && /(manifest\.json|\.mp3)$/i.test(f.name),
    });
  } catch {
    throw new ToeflImportError("No se pudo abrir el archivo: ¿es un .zip válido?");
  }

  const manifests = Object.keys(entries)
    .filter((p) => /(^|\/)manifest\.json$/i.test(p))
    .sort((a, b) => a.split("/").length - b.split("/").length);
  if (manifests.length === 0) throw new ToeflImportError("El ZIP no trae manifest.json.");
  const manifestPath = manifests[0];
  const base = manifestPath.slice(0, manifestPath.length - "manifest.json".length);

  const files = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(entries)) {
    if (path.startsWith(base) && path !== manifestPath && /\.mp3$/i.test(path)) files.set(path.slice(base.length), data);
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(entries[manifestPath]).replace(/^﻿/, ""));
  } catch (e) {
    throw new ToeflImportError(`manifest.json no es JSON válido: ${(e as Error).message}`);
  }
  const list = manifestList(json);
  if (!list) throw new ToeflImportError("manifest.json debe ser un arreglo de preguntas (o { \"preguntas\": [...] }).");
  if (list.length === 0) throw new ToeflImportError("manifest.json no trae preguntas.");

  const manifest = parseManifest(list, [...files.keys()]);
  const audioBytes = manifest.assets.reduce((sum, a) => sum + (a.audioFile ? (files.get(a.audioFile)?.byteLength ?? 0) : 0), 0);
  return { ...manifest, archivo: file.name, files, audioBytes };
}

async function sha256(data: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Progreso = { fase: "audios" | "preguntas"; hechos: number; total: number };
export type ResultadoImport = { total: number; nuevas: number; actualizadas: number; audios: number; pasajes: number };

/** Sube los audios y guarda el paquete; todo o nada. */
export async function importPaquete(paquete: Paquete, onProgress: (p: Progreso) => void): Promise<ResultadoImport> {
  const conAudio = paquete.assets.filter((a): a is AssetDraft & { audioFile: string } => Boolean(a.audioFile));
  const creados: string[] = [];
  const rows: ToeflAssetRow[] = [];

  const rollback = async () => {
    if (creados.length) await supabase.storage.from(BUCKET).remove(creados);
  };

  try {
    let hechos = 0;
    onProgress({ fase: "audios", hechos, total: conAudio.length });
    // De 4 en 4 para no saturar la conexión.
    for (let i = 0; i < conAudio.length; i += 4) {
      await Promise.all(
        conAudio.slice(i, i + 4).map(async (asset) => {
          const data = paquete.files.get(asset.audioFile)!;
          const path = `${asset.audio_key}/${(await sha256(data)).slice(0, 16)}.mp3`;
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, new Blob([data as BlobPart], { type: "audio/mpeg" }), { contentType: "audio/mpeg", upsert: false });
          // Ya existía exactamente ese audio (reimportación): se reutiliza y no se borra en un rollback.
          const existed = error && /exists|duplicate/i.test(error.message);
          if (error && !existed) throw new ToeflImportError(`No se pudo subir ${asset.audioFile}: ${error.message}`);
          if (!existed) creados.push(path);
          rows.push(assetRow(asset, path));
          onProgress({ fase: "audios", hechos: ++hechos, total: conAudio.length });
        })
      );
    }
    for (const asset of paquete.assets) if (!asset.audioFile) rows.push(assetRow(asset, null));

    onProgress({ fase: "preguntas", hechos: 0, total: paquete.items.length });
    const { data, error } = await supabase.rpc("importar_toefl", {
      p_archivo: paquete.archivo,
      p_assets: rows,
      p_items: paquete.items,
    });
    if (error) {
      if (error.code === "42501") throw new ToeflImportError("No tienes permiso para importar preguntas TOEFL.");
      if (error.code === "PGRST202") throw new ToeflImportError("Falta aplicar la migración TOEFL en Supabase.");
      throw new ToeflImportError(error.message);
    }
    onProgress({ fase: "preguntas", hechos: paquete.items.length, total: paquete.items.length });
    return data as ResultadoImport;
  } catch (e) {
    await rollback().catch(() => undefined);
    throw e instanceof ToeflImportError ? e : new ToeflImportError((e as Error).message);
  }
}

function assetRow(asset: AssetDraft, path: string | null): ToeflAssetRow {
  return {
    context_key: asset.context_key,
    audio_key: asset.audio_key,
    audio_path: path,
    audio_url: path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null,
    audio_max_plays: asset.audio_max_plays,
    reading_passage: asset.reading_passage,
    transcription_audio: asset.transcription_audio,
  };
}

/* ─────────────────────────── Inventario ─────────────────────────── */

export type InventarioToefl = {
  total: number;
  inactivas: number;
  audios: number;
  pasajes: number;
  celdas: { age_range: AgeRange; mcer_level: McerLevel; section: Section; total: number }[];
};

export async function getInventario(): Promise<InventarioToefl> {
  const { data, error } = await supabase.rpc("inventario_toefl");
  if (error) {
    if (error.code === "PGRST202") throw new ToeflImportError("Falta aplicar la migración TOEFL en Supabase.");
    throw new ToeflImportError(error.message);
  }
  return data as InventarioToefl;
}

export type LoteToefl = { id: number; archivo: string; total: number; nuevas: number; actualizadas: number; audios: number; created_at: string };

export async function getLotes(): Promise<LoteToefl[]> {
  const { data, error } = await supabase
    .from("toefl_import_batches")
    .select("id, archivo, total, nuevas, actualizadas, audios, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return [];
  return data as LoteToefl[];
}
