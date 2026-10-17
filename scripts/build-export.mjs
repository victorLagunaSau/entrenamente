// Export estático para Capacitor (CAPACITOR_BUILD=1). Las rutas de servidor (src/app/api) no caben en un export
// —la app llama a las de la web—, así que se apartan mientras compila y se regresan al terminar, falle o no.
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const api = "src/app/api";
const aside = "src/.api-fuera-del-export";
const moved = existsSync(api);
if (moved) renameSync(api, aside);

let status = 1;
try {
  status = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    env: { ...process.env, CAPACITOR_BUILD: "1" },
  }).status ?? 1;
} finally {
  if (moved) renameSync(aside, api);
}
process.exit(status);
