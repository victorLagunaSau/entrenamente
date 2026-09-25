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
| 2 | `/auth` | Login · Recuperación (redirige `?invite_code=` al registro) |
| 2b | `/registro` | Wizard de registro: Estudiante, Padre/Tutor y estudiante invitado |
| 3 | `/app/student` | Panel del Estudiante (sidebar + bottom nav) |
| 4 | `/app/dashboard` | Dashboard Padres/Maestros |
| 5 | `/admin/ingest` | Backoffice de ingesta (layout aislado) |

## Estructura

Cada módulo vive en `src/features/<módulo>/` con sus propios `components/`, `context/`, `data/`, `lib/` y `services/`;
las páginas de `src/app/` solo los importan. Lo compartido queda en `src/components/{ui,layout}` y `src/lib`.

| Módulo | Carpeta |
|---|---|
| Landing | `src/features/landing` |
| Login / recuperación | `src/features/auth` |
| Registro (wizard) | `src/features/registro` |
| Panel del estudiante | `src/features/student` |
| Dashboard padres/tutores | `src/features/dashboard` |
| Backoffice | `src/features/admin` |

**Registro con datos simulados** (`src/features/registro/services/registration-service.ts`, se reemplaza por Supabase + Stripe):
perfil preseleccionado `/registro?perfil=estudiante|tutor` · correo ya registrado `demo@entrenamente.com` · invitación válida `/auth?invite_code=DEMO2026` · en el modal de pago, la casilla «DEV» simula una tarjeta rechazada.

## Marca y tema

Tokens en `src/app/globals.css` (oscuro por defecto), según el kit de marca:

- Fondo `#0A1830` · tarjetas en marino de marca `#0F2344`
- `primary` Azul `#1E6FE6` (rellenos, texto blanco) · `brand-light` `#4C9AFF` (azul como texto/ícono sobre marino)
- `secondary` Turquesa `#12C2A9` · `bg-brand-gradient` Turquesa → Azul
- `muted-foreground` `#A9BCD0` (gris del lema) · `text-cool` `#E2E8F0`
- `energy` `#FF5E1A` / `gold` `#FFD166`: solo para gamificación (rachas, XP, logros) y el badge de admin
- Universidades `--uni-*` (`bg-uni-unam`, `bg-uni-ipn`/`poli`, `uam`, `uvm`, `tec`, `udg`): solo para identificar cada institución con `<UniversityBadge>`
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
