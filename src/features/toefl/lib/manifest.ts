/**
 * Lectura y validación del paquete TOEFL (.zip):
 *
 *   paquete_toefl_100.zip
 *   ├── manifest.json        ← arreglo de preguntas (o { "preguntas": [...] })
 *   └── audios/              ← AUD-TOEFL-LIST-1001.mp3 …
 *
 * Cada pregunta del manifest:
 *   { id, seedCode?, ageRange, mcerLevel, section, audioKey?, audioMaxPlays?, transcription?,
 *     passageKey?, readingPassage?, questionText, options: [{ id, texto, ponderacion,
 *     diagnosticoError_es, diagnosticoError_en }], stepByStepExplanation_es, stepByStepExplanation_en }
 *
 * Las preguntas que comparten audioKey (o passageKey, o el mismo pasaje) apuntan al mismo contexto.
 * Todo es puro (sin red) para poder validar antes de subir un solo archivo.
 */

import { PONDERACIONES, type Ponderacion } from "@/features/exam/types";

import {
  AGE_RANGES,
  type AgeRange,
  MCER_LEVELS,
  type McerLevel,
  SECTIONS,
  type Section,
  type ToeflAssetRow,
  type ToeflOption,
  type ToeflQuestionRow,
} from "../types";

export const ID_PATTERN = /^TOEFL-[A-Z]{3,5}-(A1|A2|B1|B2|C1|C2)-[0-9]{3,5}-V[0-9]{2,3}$/;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export type Issue = { level: "error" | "aviso"; id: string | null; message: string };

/** Contexto del paquete; `audioFile` es la ruta dentro del ZIP (se sube antes de importar). */
export type AssetDraft = Omit<ToeflAssetRow, "audio_path" | "audio_url"> & { audioFile: string | null };

export type Manifest = {
  /** Elementos del manifest (válidos o no). */
  total: number;
  items: ToeflQuestionRow[];
  assets: AssetDraft[];
  issues: Issue[];
  /** audioKey sin su MP3 en audios/: bloquean la importación. */
  missingAudios: string[];
  /** MP3 del paquete que ninguna pregunta usa. */
  unusedAudios: string[];
};

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
/** Primer valor presente entre varias llaves (acepta camelCase y snake_case). */
const pick = (o: Raw, ...keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null);

function steps(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  return v.map(str).filter(Boolean);
}

/** md5 no está en el navegador; para la llave de un pasaje basta un hash estable y corto. */
function passageHash(text: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x5bd1e995) >>> 0;
  }
  return `PAS-${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`.toUpperCase();
}

/** Arreglo de preguntas a partir del JSON (arreglo directo o envuelto). */
export function manifestList(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return json;
  if (isObj(json)) {
    const list = pick(json, "preguntas", "questions", "reactivos", "items");
    if (Array.isArray(list)) return list;
  }
  return null;
}

/**
 * Valida el manifest contra los archivos del ZIP.
 * @param audioFiles rutas de los MP3 dentro del ZIP, ya relativas a la carpeta del manifest (ej. "audios/AUD-1.mp3").
 */
export function parseManifest(list: unknown[], audioFiles: string[]): Manifest {
  const issues: Issue[] = [];
  const add = (level: Issue["level"], id: string | null, message: string) => issues.push({ level, id, message });

  // audioKey (en minúsculas) → ruta del MP3; se busca solo en audios/.
  const audioByKey = new Map<string, string>();
  for (const path of audioFiles) {
    const m = /^audios\/([^/]+)\.mp3$/i.exec(path);
    if (m) audioByKey.set(m[1].toLowerCase(), path);
  }

  const items: ToeflQuestionRow[] = [];
  const assets = new Map<string, AssetDraft>();
  const seen = new Set<string>();
  const missing = new Set<string>();
  const usedAudio = new Set<string>();

  list.forEach((raw, index) => {
    if (!isObj(raw)) {
      add("error", null, `El elemento ${index + 1} del manifest no es un objeto.`);
      return;
    }
    const id = str(pick(raw, "id"));
    const ref = id || `#${index + 1}`;
    let ok = true;
    const error = (message: string) => {
      ok = false;
      add("error", ref, message);
    };

    if (!id) error("Falta el id.");
    else if (!ID_PATTERN.test(id)) error("El id no sigue el formato TOEFL-SECC-NIVEL-0000-V00.");
    if (id && seen.has(id)) error("El id está repetido en el manifest.");
    seen.add(id);

    const ageRange = str(pick(raw, "ageRange", "age_range")) as AgeRange;
    if (!AGE_RANGES.includes(ageRange)) error(`ageRange debe ser ${AGE_RANGES.join(", ")}.`);

    const mcerLevel = str(pick(raw, "mcerLevel", "mcer_level")).toUpperCase() as McerLevel;
    if (!MCER_LEVELS.includes(mcerLevel)) error(`mcerLevel debe ser ${MCER_LEVELS.join(", ")}.`);
    else if (ID_PATTERN.test(id) && id.split("-")[2] !== mcerLevel) error(`El nivel del id no coincide con mcerLevel (${mcerLevel}).`);

    const section = str(pick(raw, "section")).toLowerCase() as Section;
    if (!SECTIONS.includes(section)) error(`section debe ser ${SECTIONS.join(", ")}.`);

    const seedCode = str(pick(raw, "seedCode", "seed_code")) || id.replace(/-V[0-9]{2,3}$/, "");

    const questionText = str(pick(raw, "questionText", "question_text"));
    if (!questionText) error("Falta questionText.");

    // Opciones
    const rawOptions = pick(raw, "options");
    const options: ToeflOption[] = [];
    if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
      error("Necesita al menos 2 opciones.");
    } else {
      const ids = new Set<string>();
      rawOptions.forEach((o, i) => {
        if (!isObj(o)) return error(`La opción ${i + 1} no es un objeto.`);
        const optId = str(pick(o, "id")) || String.fromCharCode(65 + i);
        if (ids.has(optId)) error(`La opción ${optId} está repetida.`);
        ids.add(optId);
        const texto = str(pick(o, "texto", "text"));
        if (!texto) error(`La opción ${optId} no tiene texto.`);
        const ponderacion = Number(pick(o, "ponderacion")) as Ponderacion;
        if (!PONDERACIONES.includes(ponderacion)) error(`Ponderación de ${optId}: usa 1.0, 0.75, 0.5, 0.25 o 0.0.`);
        const es = str(pick(o, "diagnosticoError_es", "diagnostico_error_es")) || null;
        const en = str(pick(o, "diagnosticoError_en", "diagnostico_error_en")) || null;
        if (ponderacion < 1 && (!es || !en)) add("aviso", ref, `La opción ${optId} no trae el diagnóstico del error en ${!es && !en ? "español ni inglés" : !es ? "español" : "inglés"}.`);
        options.push({
          id: optId,
          texto,
          ponderacion,
          diagnosticoError_es: ponderacion === 1 ? null : es,
          diagnosticoError_en: ponderacion === 1 ? null : en,
        });
      });
      const correctas = options.filter((o) => o.ponderacion === 1).length;
      if (correctas !== 1) error(`Debe haber exactamente una opción con ponderación 1 (hay ${correctas}).`);
    }

    // Solución paso a paso
    const stepsEs = steps(pick(raw, "stepByStepExplanation_es", "step_by_step_explanation_es"));
    const stepsEn = steps(pick(raw, "stepByStepExplanation_en", "step_by_step_explanation_en"));
    if (!stepsEs) error("stepByStepExplanation_es debe ser un arreglo de textos.");
    if (!stepsEn) error("stepByStepExplanation_en debe ser un arreglo de textos.");
    if (stepsEs?.length === 0 || stepsEn?.length === 0)
      add("aviso", ref, `Falta la solución paso a paso en ${stepsEs?.length === 0 && stepsEn?.length === 0 ? "español e inglés" : stepsEs?.length === 0 ? "español" : "inglés"}.`);

    // Contexto: audio y/o pasaje
    const audioKey = str(pick(raw, "audioKey", "audio_key")) || null;
    const passage = str(pick(raw, "readingPassage", "reading_passage")) || null;
    const transcription = str(pick(raw, "transcription", "transcriptionAudio", "transcription_audio")) || null;
    const maxPlays = Number(pick(raw, "audioMaxPlays", "audio_max_plays") ?? 1);
    const passageKey = str(pick(raw, "passageKey", "passage_key")) || null;

    if (audioKey && !KEY_PATTERN.test(audioKey)) error("audioKey solo admite letras, números, - y _.");
    if (passageKey && !KEY_PATTERN.test(passageKey)) error("passageKey solo admite letras, números, - y _.");
    if (section === "listening" && !audioKey) error("Las preguntas de listening necesitan audioKey.");
    if (section === "reading" && !passage && !passageKey) add("aviso", ref, "Pregunta de reading sin readingPassage.");
    if (audioKey && (!Number.isInteger(maxPlays) || maxPlays < 1 || maxPlays > 5)) error("audioMaxPlays debe ser un entero de 1 a 5.");
    if (audioKey && !transcription) add("aviso", ref, "El audio no trae transcription.");

    let contextKey: string | null = null;
    if (audioKey) {
      contextKey = audioKey;
      const file = audioByKey.get(audioKey.toLowerCase()) ?? null;
      if (!file) missing.add(audioKey);
      else usedAudio.add(file);
      mergeAsset(assets, contextKey, ref, add, {
        context_key: contextKey,
        audio_key: audioKey,
        audioFile: file,
        audio_max_plays: Number.isInteger(maxPlays) ? maxPlays : 1,
        reading_passage: passage,
        transcription_audio: transcription,
      });
    } else if (passage || passageKey) {
      contextKey = passageKey ?? passageHash(passage!);
      mergeAsset(assets, contextKey, ref, add, {
        context_key: contextKey,
        audio_key: null,
        audioFile: null,
        audio_max_plays: 1,
        reading_passage: passage,
        transcription_audio: null,
      });
    }

    if (!ok) return;
    items.push({
      id,
      seed_code: seedCode,
      age_range: ageRange,
      mcer_level: mcerLevel,
      section,
      context_key: contextKey,
      question_text: questionText,
      options,
      step_by_step_explanation_es: stepsEs ?? [],
      step_by_step_explanation_en: stepsEn ?? [],
    });
  });

  for (const asset of assets.values()) {
    if (!asset.audio_key && !asset.reading_passage) add("error", asset.context_key, "El passageKey no trae readingPassage en ninguna pregunta.");
  }

  const missingAudios = [...missing].sort();
  for (const key of missingAudios) add("error", key, `Falta el archivo audios/${key}.mp3 en el ZIP.`);

  const unusedAudios = [...audioByKey.values()].filter((f) => !usedAudio.has(f)).sort();
  if (unusedAudios.length) add("aviso", null, `${unusedAudios.length} MP3 del paquete no los usa ninguna pregunta.`);
  const fueraDeCarpeta = audioFiles.filter((f) => !/^audios\/[^/]+\.mp3$/i.test(f));
  if (fueraDeCarpeta.length) add("aviso", null, `${fueraDeCarpeta.length} MP3 están fuera de audios/ y se ignoran.`);

  return { total: list.length, items, assets: [...assets.values()], issues, missingAudios, unusedAudios };
}

/** Une la información de un contexto compartido; si dos preguntas se contradicen gana la primera. */
function mergeAsset(
  assets: Map<string, AssetDraft>,
  key: string,
  ref: string,
  add: (level: Issue["level"], id: string | null, message: string) => void,
  next: AssetDraft
) {
  const prev = assets.get(key);
  if (!prev) {
    assets.set(key, next);
    return;
  }
  if (next.audio_key && prev.audio_max_plays !== next.audio_max_plays) add("aviso", ref, `audioMaxPlays distinto al de otra pregunta con ${key}; se usa ${prev.audio_max_plays}.`);
  if (prev.reading_passage && next.reading_passage && prev.reading_passage !== next.reading_passage)
    add("aviso", ref, `readingPassage distinto al de otra pregunta con ${key}; se usa el primero.`);
  if (prev.transcription_audio && next.transcription_audio && prev.transcription_audio !== next.transcription_audio)
    add("aviso", ref, `transcription distinta a la de otra pregunta con ${key}; se usa la primera.`);
  prev.reading_passage ??= next.reading_passage;
  prev.transcription_audio ??= next.transcription_audio;
}

export const hasErrors = (m: Manifest) => m.issues.some((i) => i.level === "error");

/** Paquete de ejemplo para el botón «Descargar ejemplo» (sin audios). */
export const EXAMPLE_MANIFEST = [
  {
    id: "TOEFL-LIST-B2-1001-V01",
    seedCode: "TOEFL-LIST-B2-1001",
    ageRange: "16_mas",
    mcerLevel: "B2",
    section: "listening",
    audioKey: "AUD-TOEFL-LIST-1001",
    audioMaxPlays: 1,
    transcription: "W: Did you finish the lab report? M: Just barely — I was up until three.",
    readingPassage: null,
    questionText: "What does the man imply about the lab report?",
    options: [
      { id: "A", texto: "He barely finished it.", ponderacion: 1, diagnosticoError_es: null, diagnosticoError_en: null },
      {
        id: "B",
        texto: "He completed it easily.",
        ponderacion: 0,
        diagnosticoError_es: "«Just barely» significa que lo logró con mucho esfuerzo, no con facilidad.",
        diagnosticoError_en: "“Just barely” means he managed it with difficulty, not easily.",
      },
      {
        id: "C",
        texto: "He skipped the assignment.",
        ponderacion: 0,
        diagnosticoError_es: "Sí lo terminó: «just barely» confirma que lo entregó.",
        diagnosticoError_en: "He did finish: “just barely” confirms it was done.",
      },
      {
        id: "D",
        texto: "He asked for help.",
        ponderacion: 0.25,
        diagnosticoError_es: "El diálogo no menciona ayuda; solo que se desveló.",
        diagnosticoError_en: "The dialogue never mentions help, only that he stayed up late.",
      },
    ],
    stepByStepExplanation_es: ["Escucha la respuesta del hombre: «Just barely».", "«Just barely» = apenas, con dificultad.", "La opción A lo dice con otras palabras."],
    stepByStepExplanation_en: ["Listen to the man's answer: “Just barely”.", "“Just barely” = with difficulty.", "Option A paraphrases it."],
  },
];
