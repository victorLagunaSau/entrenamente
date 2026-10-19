# Paquete TOEFL ITP (.zip)

Se importa en `/admin/toefl-import`. Si falta un MP3 o una pregunta no pasa la validación, no se importa nada.

```
paquete_toefl_100.zip
├── manifest.json      ← arreglo de preguntas (o { "preguntas": [...] })
└── audios/            ← <audioKey>.mp3
```

## Pregunta

| Llave | Obligatoria | Notas |
| --- | --- | --- |
| `id` | sí | `TOEFL-<SECC>-<NIVEL>-<0000>-V<00>`, ej. `TOEFL-LIST-B2-1001-V01`; el nivel debe coincidir con `mcerLevel` |
| `seedCode` | no | Por defecto, el `id` sin `-V00` |
| `ageRange` | sí | `8_11_primary`, `11_15_junior`, `16_mas` |
| `mcerLevel` | sí | `A1` … `C2` |
| `section` | sí | `listening`, `structure`, `reading` |
| `audioKey` | listening | Nombre del MP3 en `audios/` sin extensión; varias preguntas pueden compartirlo |
| `audioMaxPlays` | no | 1 a 5 (por defecto 1) |
| `transcription` | no | Transcripción del audio (aviso si falta) |
| `readingPassage` | reading | Pasaje; el mismo texto en varias preguntas se guarda una sola vez |
| `passageKey` | no | Llave explícita para compartir un pasaje |
| `questionText` | sí | Enunciado en inglés |
| `options` | sí | `[{ id, texto, ponderacion, diagnosticoError_es, diagnosticoError_en }]`; ponderación 1, 0.75, 0.5, 0.25 o 0 y exactamente una con 1 |
| `stepByStepExplanation_es` / `_en` | sí | Arreglo de pasos (aviso si falta alguno) |

Reimportar un `id` existente lo actualiza. El panel descarga un `manifest.json` de ejemplo.
