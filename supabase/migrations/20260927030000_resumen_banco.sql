-- Entrena Mente · Preconsulta del catálogo del banco de preguntas.
--
-- Se corre DESPUÉS de 20260927020000_banco_preguntas.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run.
--
-- resumen_banco() devuelve solo CONTEOS (nunca filas de preguntas) para que los filtros del catálogo
-- ofrezcan únicamente opciones con preguntas, en cascada:
--   Institución → Área (opcional) → Carrera (opcional) → Materia.
-- Las preguntas se asignan a carreras (reactivo_carreras); área y materia se derivan de ahí.
-- Cada conteo es de reactivos DISTINTOS (una pregunta de un área cuenta una vez aunque tenga 39 carreras).
-- Usa los índices de reactivos (institucion_id, materia_clave) y reactivo_carreras (carrera_id).

begin;

create or replace function public.resumen_banco(
  p_institucion text default null,   -- clave (UNAM)
  p_area text default null,          -- id de área (unam-a1)
  p_carrera text default null        -- id de carrera
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with inst as (
    select i.id from public.instituciones i where i.clave = p_institucion
  ),
  -- Reactivos de la institución que cumplen área/carrera (si se eligieron).
  filtrados as (
    select r.id, r.materia_clave
    from public.reactivos r
    where r.institucion_id = (select id from inst)
      and (
        (p_area is null and p_carrera is null)
        or exists (
          select 1
          from public.reactivo_carreras rc
          join public.carreras c on c.id = rc.carrera_id
          where rc.reactivo_id = r.id
            and (p_carrera is null or rc.carrera_id = p_carrera)
            and (p_area is null or c.area_id = p_area)
        )
      )
  )
  select jsonb_build_object(
    'instituciones', coalesce((
      select jsonb_agg(jsonb_build_object('clave', x.clave, 'total', x.total) order by x.clave)
      from (
        select i.clave, count(*) as total
        from public.reactivos r join public.instituciones i on i.id = r.institucion_id
        group by i.clave
      ) x
    ), '[]'),
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.area_id, 'total', x.total))
      from (
        select c.area_id, count(distinct rc.reactivo_id) as total
        from public.reactivo_carreras rc join public.carreras c on c.id = rc.carrera_id
        where c.institucion_id = (select id from inst) and c.area_id is not null
        group by c.area_id
      ) x
    ), '[]'),
    'carreras', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.carrera_id, 'total', x.total))
      from (
        select rc.carrera_id, count(*) as total
        from public.reactivo_carreras rc join public.carreras c on c.id = rc.carrera_id
        where c.institucion_id = (select id from inst) and (p_area is null or c.area_id = p_area)
        group by rc.carrera_id
      ) x
    ), '[]'),
    'materias', coalesce((
      select jsonb_agg(jsonb_build_object('clave', x.materia_clave, 'total', x.total) order by x.materia_clave)
      from (select f.materia_clave, count(*) as total from filtrados f group by f.materia_clave) x
    ), '[]')
  );
$$;

revoke execute on function public.resumen_banco(text, text, text) from public, anon;
grant execute on function public.resumen_banco(text, text, text) to authenticated;

commit;
