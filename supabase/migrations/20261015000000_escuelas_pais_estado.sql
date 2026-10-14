-- Entrena Mente · País y estado "Próximamente" de las escuelas.
--
-- Se corre DESPUÉS de 20261014000000_grados_paises.sql (usa la tabla `paises`).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · instituciones.pais → código de `paises` (MX, GT, US). Opcional: un examen internacional no tiene país.
--     Sirve para filtrar por país más adelante.
--   · instituciones.proximamente → estado de la escuela junto con `activo`:
--       Activa        activo = true                         (exámenes, metas y buscador)
--       Próximamente  activo = false, proximamente = true   (se ve en buscador y landing, no se elige)
--       Inactiva      activo = false, proximamente = false  (solo la ve el admin)
--     `activo` no cambia de significado: las funciones de examen y metas siguen pidiendo `i.activo`,
--     así que una escuela en Próximamente nunca da exámenes.
--   · Lectura pública de instituciones: activas y próximamente (para pintar su identidad en el buscador).
--     Áreas y carreras siguen visibles por tabla solo con institución activa; las de Próximamente llegan
--     únicamente por catalogo_publico().
--   · Datos: las 6 universidades quedan en MX. TOEFL queda Inactiva y sin país (tendrá su propia
--     herramienta); no se borra nada: sus reactivos, metas e historial se conservan.

begin;

-- ═════════════════════════ 1. Columnas ═════════════════════════

alter table public.instituciones
  add column pais char(2) references public.paises(codigo),
  add column proximamente boolean not null default false,
  add constraint instituciones_estado_check check (not (activo and proximamente));

create index instituciones_pais_idx on public.instituciones (pais);

grant update (pais, proximamente) on public.instituciones to authenticated;

-- ═════════════════════════ 2. Datos actuales ═════════════════════════

update public.instituciones set pais = 'MX' where tipo = 'universidad';
update public.instituciones set activo = false, proximamente = false, pais = null where id = 'toefl';

-- ═════════════════════════ 3. Lectura pública ═════════════════════════

drop policy "instituciones: activas" on public.instituciones;
create policy "instituciones: activas y próximamente" on public.instituciones
  for select to anon, authenticated using (activo or proximamente);

-- ═════════════════════════ 4. Catálogo público ═════════════════════════
-- Igual que antes, más las carreras de escuelas en Próximamente (el front las muestra bloqueadas).

create or replace function public.catalogo_publico()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with inst as (
    select i.id from public.instituciones i where i.activo or i.proximamente
  )
  select jsonb_build_object(
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'institucion_id', a.institucion_id, 'codigo', a.codigo, 'nombre', a.nombre, 'orden', a.orden
      ) order by a.institucion_id, a.orden)
      from public.areas a
      where a.activo and a.institucion_id in (select id from inst)
    ), '[]'::jsonb),
    'carreras', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'institucion_id', c.institucion_id, 'area_id', c.area_id, 'nombre', c.nombre, 'orden', c.orden,
        'con_reactivos', exists (select 1 from public.reactivo_carreras rc where rc.carrera_id = c.id)
      ) order by c.institucion_id, c.orden)
      from public.carreras c
      where c.activo and c.institucion_id in (select id from inst)
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.catalogo_publico() from public;
grant execute on function public.catalogo_publico() to anon, authenticated;

commit;
