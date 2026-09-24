# ExaMente

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Lucide · Capacitor.

## Desarrollo

```bash
npm install
npm run dev
```

## Rutas

| # | Ruta | Vista |
|---|------|-------|
| 1 | `/` | Landing B2C |
| 2 | `/auth` | Login · Registro · Recuperación |
| 3 | `/app/student` | Panel del Estudiante (sidebar + bottom nav) |
| 4 | `/app/dashboard` | Dashboard Padres/Maestros |
| 5 | `/admin/ingest` | Backoffice de ingesta (layout aislado) |

La **Dev Toolbar** (`src/components/layout/dev-toolbar.tsx`) es temporal: quitarla de `src/app/layout.tsx` antes de producción.

## Tema

Tokens en `src/app/globals.css` (oscuro por defecto): `background #12131C`, `primary #FF5E1A`, `secondary #FFD166`, texto `#FFFFFF` / `text-cool #E2E8F0`.

Añadir componentes shadcn: `npx shadcn@latest add <componente>`.

## Móvil (Capacitor)

`npm run build:export` genera un export estático en `out/` (`CAPACITOR_BUILD=1`). Para crear las plataformas nativas la primera vez:

```bash
npm i @capacitor/ios @capacitor/android
npx cap add ios && npx cap add android
npm run build:mobile
```

## Despliegue

Vercel detecta Next.js automáticamente (build normal, sin export).
