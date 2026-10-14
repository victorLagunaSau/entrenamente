-- Entrena Mente · Catálogo público en una sola consulta (registro, buscador de carreras, landing y metas).
--
-- Pegar completo en Supabase → SQL Editor → Run. Solo agrega una función de lectura: no cambia tablas ni datos.
--
-- catalogo_publico() → { areas: [...], carreras: [...] } con lo activo de instituciones activas.
--   · Cada carrera trae `con_reactivos`: si ya tiene al menos un reactivo asignado. Las que no, el front las
--     muestra como "Próximamente" (se pueden elegir; así se sabe qué carreras piden los usuarios).
--   · Security definer: `reactivo_carreras` solo la lee el admin; aquí se expone únicamente el sí/no.
--   · El front la descarga una vez por sesión y la guarda en el teléfono (src/features/catalogo).

begin;

create or replace function public.catalogo_publico()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with inst as (
    select i.id from public.instituciones i where i.activo
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
