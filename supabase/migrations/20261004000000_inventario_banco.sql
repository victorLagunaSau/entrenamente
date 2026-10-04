-- Entrena Mente · Inventario del banco de preguntas (cuántas hay por escuela, área y carrera).
--
-- Se corre DESPUÉS de 20260928020000_dosificacion.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Solo crea una función de lectura: no cambia datos.
--
-- inventario_banco() devuelve solo CONTEOS (nunca el texto de las preguntas):
--   · instituciones / areas / carreras: preguntas (todas las variantes), raíces (sin variantes),
--     por materia y por dificultad. En áreas e instituciones cada pregunta cuenta una vez aunque
--     esté asignada a muchas carreras.
--   · sin_carrera: preguntas que no quedaron asignadas a ninguna carrera.
--   · dosificacion: % por materia guardado por carrera.
--   · lotes: últimas 30 cargas masivas.
-- security invoker: las políticas de admin de cada tabla siguen aplicando.

begin;

create or replace function public.inventario_banco()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select r.id, r.institucion_id, r.materia_clave, r.dificultad, regexp_replace(r.codigo, '-V[0-9]+$', '') as raiz
    from public.reactivos r
  ),
  asignados as (
    select b.*, rc.carrera_id, c.area_id
    from base b
    join public.reactivo_carreras rc on rc.reactivo_id = b.id
    join public.carreras c on c.id = rc.carrera_id
  ),
  -- Una fila por (grupo, materia, dificultad) para armar los desgloses sin repetir conteos.
  por_carrera as (
    select carrera_id as grupo, materia_clave, dificultad, count(distinct id) as n, count(distinct raiz) as raices
    from asignados group by grouping sets ((carrera_id), (carrera_id, materia_clave), (carrera_id, dificultad))
  ),
  por_area as (
    select area_id as grupo, materia_clave, dificultad, count(distinct id) as n, count(distinct raiz) as raices
    from asignados where area_id is not null
    group by grouping sets ((area_id), (area_id, materia_clave), (area_id, dificultad))
  ),
  por_inst as (
    select institucion_id as grupo, materia_clave, dificultad, count(distinct id) as n, count(distinct raiz) as raices
    from base group by grouping sets ((institucion_id), (institucion_id, materia_clave), (institucion_id, dificultad))
  ),
  todos as (
    select 'carrera' as nivel, * from por_carrera
    union all select 'area', * from por_area
    union all select 'institucion', * from por_inst
  ),
  resumen as (
    select t.nivel, t.grupo,
      max(t.n) filter (where t.materia_clave is null and t.dificultad is null) as total,
      max(t.raices) filter (where t.materia_clave is null and t.dificultad is null) as raices,
      coalesce(jsonb_object_agg(t.materia_clave, t.n) filter (where t.materia_clave is not null), '{}') as por_materia,
      coalesce(jsonb_object_agg(t.dificultad, t.n) filter (where t.dificultad is not null), '{}') as por_dificultad
    from todos t
    group by t.nivel, t.grupo
  )
  select jsonb_build_object(
    'instituciones', coalesce((
      select jsonb_agg(jsonb_build_object('id', grupo, 'total', total, 'raices', raices, 'por_materia', por_materia, 'por_dificultad', por_dificultad))
      from resumen where nivel = 'institucion'
    ), '[]'),
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('id', grupo, 'total', total, 'raices', raices, 'por_materia', por_materia, 'por_dificultad', por_dificultad))
      from resumen where nivel = 'area'
    ), '[]'),
    'carreras', coalesce((
      select jsonb_agg(jsonb_build_object('id', grupo, 'total', total, 'raices', raices, 'por_materia', por_materia, 'por_dificultad', por_dificultad))
      from resumen where nivel = 'carrera'
    ), '[]'),
    'sin_carrera', (
      select count(*) from public.reactivos r
      where not exists (select 1 from public.reactivo_carreras rc where rc.reactivo_id = r.id)
    ),
    'dosificacion', coalesce((
      select jsonb_agg(jsonb_build_object(
        'carrera_id', d.carrera_id, 'por_materia', d.por_materia, 'metodo', d.metodo, 'fuente', d.fuente,
        'total_reactivos_oficial', d.total_reactivos_oficial, 'archivo', d.archivo, 'actualizado', d.actualizado
      ))
      from public.carrera_dosificacion d
    ), '[]'),
    'lotes', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
      from (
        select id, archivo, institucion_id, carreras, total, nuevas, actualizadas, sin_cambios, omitidas, created_at
        from public.lotes_importacion order by created_at desc limit 30
      ) l
    ), '[]')
  );
$$;

revoke execute on function public.inventario_banco() from public, anon;
grant execute on function public.inventario_banco() to authenticated;

commit;
