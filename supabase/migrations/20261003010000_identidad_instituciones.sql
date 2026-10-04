-- Entrena Mente · Identidad dinámica de instituciones (sigla, colores, ícono y logo desde Supabase).
--
-- Se corre DESPUÉS de 20261003000000_invitaciones_por_estudiante.sql.
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · instituciones: nuevas columnas de identidad.
--       sigla            → lo que ve el usuario (UNAM, CU…). Distinta de `clave`, que es el prefijo de reactivos.
--       color_primario   → HEX; barra, botones y badges del examen.
--       color_secundario → HEX; detalles y degradados.
--       color_acento     → HEX; resaltados.
--       icono_svg        → vector lineal en blanco (viewBox libre). Se valida: sin scripts, eventos ni enlaces.
--       logo_url         → logo oficial subido al bucket `identidad` (opcional; requiere permiso de la institución).
--   · color_id queda solo por compatibilidad (exámenes ya congelados); el front ya no lo usa.
--   · Bucket público `identidad` para logos: cualquiera lee, solo admin sube/cambia/borra.
--   · Datos de identidad de las instituciones actuales (íconos propios, no logotipos oficiales).

begin;

-- ═════════════════════════ 1. Validación de SVG ═════════════════════════

-- El front lo pinta como máscara CSS (nunca lo inserta en el DOM); aun así se rechaza lo peligroso.
create or replace function public.svg_seguro(p_svg text)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_svg is null or (
    length(p_svg) <= 20000
    and p_svg ~* '^\s*(<\?xml[^>]*>\s*)?<svg[\s>]'
    and p_svg ~* '</svg>\s*$'
    and p_svg !~* '<\s*(script|foreignobject|iframe|embed|object|image|use|style|a)[\s>/]'
    and p_svg !~* '\son[a-z]+\s*='
    and p_svg !~* '(javascript|vbscript|data):'
    -- Enlaces a otros sitios (el xmlns sí lleva http, por eso solo se revisan href, src y url()).
    and p_svg !~* '(href|src)\s*=\s*["'']?\s*[a-z]+:'
    and p_svg !~* 'url\(\s*["'']?\s*[a-z]+:'
  );
$$;

-- ═════════════════════════ 2. Columnas de identidad ═════════════════════════

alter table public.instituciones
  add column sigla text check (sigla is null or length(trim(sigla)) between 1 and 12),
  add column color_primario text check (color_primario is null or color_primario ~ '^#[0-9A-Fa-f]{6}$'),
  add column color_secundario text check (color_secundario is null or color_secundario ~ '^#[0-9A-Fa-f]{6}$'),
  add column color_acento text check (color_acento is null or color_acento ~ '^#[0-9A-Fa-f]{6}$'),
  add column icono_svg text check (public.svg_seguro(icono_svg)),
  add column logo_url text check (logo_url is null or logo_url ~ '^https://[^\s"''<>]+$');

grant update (sigla, color_primario, color_secundario, color_acento, icono_svg, logo_url)
  on public.instituciones to authenticated;

-- ═════════════════════════ 3. Identidad de las instituciones actuales ═════════════════════════
-- Colores aproximados a la paleta de cada institución; se ajustan desde /admin/escuelas.

update public.instituciones set sigla = clave where sigla is null;

update public.instituciones set
  color_primario = '#002B7A', color_secundario = '#D4AF37', color_acento = '#F2C230',
  icono_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 4l9 5.5"/><path d="M4 21h16"/><path d="M4 18h16"/><path d="M5.5 10.5V18M9.8 10.5V18M14.2 10.5V18M18.5 10.5V18"/></svg>'
where id = 'unam';

update public.instituciones set
  color_primario = '#6F1D46', color_secundario = '#B0B3B5', color_acento = '#C9A227',
  icono_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>'
where id = 'ipn';

update public.instituciones set
  color_primario = '#D4561A', color_secundario = '#1A1A1A', color_acento = '#F28C28',
  icono_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7C10 5.4 7 5 4 5.5v13c3-.5 6-.1 8 1.5 2-1.6 5-2 8-1.5v-13c-3-.5-6-.1-8 1.5z"/><path d="M12 7v13"/><path d="M7 9.5h2M15 9.5h2M7 13h2M15 13h2"/></svg>'
where id = 'uam';

update public.instituciones set
  color_primario = '#1F3864', color_secundario = '#C8A04B', color_acento = '#E0B12B',
  icono_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2.5 2.6 4 4.6 4 7a4 4 0 0 1-8 0c0-1.4.6-2.6 1.6-3.6.2 1.3.9 2.1 1.9 2.4C11.6 7 11.6 5 12 3z"/><path d="M9.5 15.5h5l-1 5.5h-3z"/></svg>'
where id = 'udg';

update public.instituciones set
  color_primario = '#00305E', color_secundario = '#F2A900', color_acento = '#FFC845',
  icono_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 19.5 9 8l3.5 5.5L15 10l6.5 9.5z"/><path d="M7.2 11.2 9 12.5l1.6-1.4"/></svg>'
where id = 'uanl';

update public.instituciones set
  color_primario = '#003B5C', color_secundario = '#00B5E2', color_acento = '#5FD3F3',
  icono_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m12 5.5 1.8 4.7 4.7 1.8-4.7 1.8-1.8 4.7-1.8-4.7L5.5 12l4.7-1.8z"/></svg>'
where id = 'buap';

update public.instituciones set
  color_primario = '#00558C', color_secundario = '#00A3AD', color_acento = '#7AB800',
  icono_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8.5L5 16.5v-3H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/><path d="M17.5 9H20a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1v3l-3.5-3H11a1 1 0 0 1-1-1v-.5"/><path d="m6.5 11.5 2-5 2 5M7.3 10h2.4"/></svg>'
where id = 'toefl';

-- ═════════════════════════ 4. Logos (Storage) ═════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identidad', 'identidad', true, 1048576, array['image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "identidad: admin sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'identidad' and public.is_admin());
create policy "identidad: admin cambia" on storage.objects
  for update to authenticated using (bucket_id = 'identidad' and public.is_admin())
  with check (bucket_id = 'identidad' and public.is_admin());
create policy "identidad: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'identidad' and public.is_admin());

commit;
