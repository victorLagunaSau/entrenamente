-- Entrena Mente · Conteo de preguntas: cada variante es una pregunta.
--
-- Se corre DESPUÉS de 20260928020000_dosificacion.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Solo reemplaza una función: se puede correr más de una vez.
--
-- opciones_examen_libre() contaba una pregunta por raíz (V01, V02… valían una). Ahora cuenta todos los reactivos
-- de la carrera, igual que el banco del admin (resumen_banco). Misma firma y salida: la app no cambia.
-- (Esta misma versión ya venía en 20260928010000_examen_plan.sql, pero en Supabase quedó la anterior.)

begin;

create or replace function public.opciones_examen_libre()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'carrera_id', x.carrera_id, 'facil', x.facil, 'media', x.media, 'dificil', x.dificil
  )), '[]')
  from (
    select rc.carrera_id,
      count(*) filter (where r.dificultad = 'facil') as facil,
      count(*) filter (where r.dificultad = 'media') as media,
      count(*) filter (where r.dificultad = 'dificil') as dificil
    from public.reactivo_carreras rc
    join public.reactivos r on r.id = rc.reactivo_id
    join public.carreras c on c.id = rc.carrera_id and c.activo
    join public.instituciones i on i.id = c.institucion_id and i.activo
    where (select auth.uid()) is not null
    group by rc.carrera_id
  ) x;
$$;

revoke execute on function public.opciones_examen_libre() from public, anon;
grant execute on function public.opciones_examen_libre() to authenticated;

commit;
