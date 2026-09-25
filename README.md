# Entrena Mente

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

## Marca y tema

Tokens en `src/app/globals.css` (oscuro por defecto), según el kit de marca:

- Fondo `#0A1830` · tarjetas en marino de marca `#0F2344`
- `primary` Azul `#1E6FE6` (rellenos, texto blanco) · `brand-light` `#4C9AFF` (azul como texto/ícono sobre marino)
- `secondary` Turquesa `#12C2A9` · `bg-brand-gradient` Turquesa → Azul
- `muted-foreground` `#A9BCD0` (gris del lema) · `text-cool` `#E2E8F0`
- `energy` `#FF5E1A` / `gold` `#FFD166`: solo para gamificación (rachas, XP, logros) y el badge de admin
- Tipografía: Poppins (títulos) + Inter (texto)

Dos versiones de marca (`src/lib/brand.ts`): **estudiante** (cuaderno) y **maestro** (tabla con check).
`<Logo audience variant>` usa los SVG `-color-oscuro` de `public/assets/`; los favicons salen de `public/favicon/<versión>/`
(`/app/dashboard` usa el de maestro, el resto el de estudiante).


## Formulario de informes (landing)

El formulario envía vía [Web3Forms](https://web3forms.com) desde el cliente (funciona también en el export de Capacitor).
El correo destino se configura al generar la access key en Web3Forms; nunca aparece en el código.

```bash
# .env.local (y en Vercel → Environment Variables)
NEXT_PUBLIC_WEB3FORMS_KEY=tu-access-key
```

## Móvil (Capacitor)

`npm run build:export` genera un export estático en `out/` (`CAPACITOR_BUILD=1`). Para crear las plataformas nativas la primera vez:

```bash
npm i @capacitor/ios @capacitor/android
npx cap add ios && npx cap add android
npm run build:mobile
```

## Despliegue

Vercel detecta Next.js automáticamente (build normal, sin export).
