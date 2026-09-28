-- Entrena Mente · Examen Libre del estudiante e historial congelado.
--
-- Se corre DESPUÉS de 20260927030000_resumen_banco.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué agrega:
--   · opciones_examen_libre(): cuántas preguntas hay por carrera y dificultad (solo conteos).
--   · generar_examen_libre(): arma el examen al azar SIN revelar ponderaciones, diagnósticos ni soluciones.
--   · exam_history: una fila por examen terminado con la "fotografía" (JSON) de cada pregunta tal como se respondió.
--     Es inmutable: nadie la edita (trigger) y el alumno no puede insertar directo.
--   · guardar_examen_libre(): califica EN LA BASE (el cliente nunca conoce la respuesta correcta antes de terminar)
--     y congela el examen en exam_history.
--
-- Las tablas del banco siguen siendo solo de admin: estas funciones son `security definer` y exponen únicamente
-- lo necesario.

begin;

-- ═════════════════════════ 1. Historial congelado ═════════════════════════

create table public.exam_history (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  exam_type text not null check (exam_type in ('libre', 'plan', 'racha')),
  university_key text not null,                                          -- clave (UNAM)
  university_name text not null,
  career_id text,                                                        -- solo referencia; el nombre va copiado
  career_name text not null,
  level text not null check (level in ('facil', 'media', 'dificil')),
  total_questions integer not null check (total_questions > 0),
  answered_questions integer not null check (answered_questions >= 0),
  score_achieved numeric(8, 2) not null,
  max_score numeric(8, 2) not null,
  time_limit_seconds integer not null check (time_limit_seconds > 0),
  time_spent_seconds integer not null check (time_spent_seconds >= 0),
  timed_out boolean not null default false,
  completed_at timestamptz not null default now(),
  -- { disclaimer_accepted, institucion, carrera, resumen_por_materia[], questions_snapshot[] }
  frozen_exam_data jsonb not null check (jsonb_typeof(frozen_exam_data) = 'object')
);

create index exam_history_student_idx on public.exam_history (student_id, completed_at desc);

create or replace function public.exam_history_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'El historial de exámenes es inmutable.' using errcode = '42501';
end;
$$;

create trigger exam_history_no_update before update on public.exam_history
  for each row execute function public.exam_history_inmutable();

alter table public.exam_history enable row level security;

create policy "exam_history: dueño o admin ve" on public.exam_history
  for select to authenticated using (student_id = (select auth.uid()) or public.is_admin());

-- Solo lectura desde el cliente; el alta es exclusiva de guardar_examen_libre().
revoke all on public.exam_history from anon, authenticated;
grant select on public.exam_history to authenticated;

-- ═════════════════════════ 2. Opciones disponibles ═════════════════════════

-- Preguntas distintas (una por raíz: las variantes V01, V02… cuentan una vez) por carrera activa y dificultad.
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
      count(distinct regexp_replace(r.codigo, '-V[0-9]+$', '')) filter (where r.dificultad = 'facil') as facil,
      count(distinct regexp_replace(r.codigo, '-V[0-9]+$', '')) filter (where r.dificultad = 'media') as media,
      count(distinct regexp_replace(r.codigo, '-V[0-9]+$', '')) filter (where r.dificultad = 'dificil') as dificil
    from public.reactivo_carreras rc
    join public.reactivos r on r.id = rc.reactivo_id
    join public.carreras c on c.id = rc.carrera_id and c.activo
    join public.instituciones i on i.id = c.institucion_id and i.activo
    where (select auth.uid()) is not null
    group by rc.carrera_id
  ) x;
$$;

-- ═════════════════════════ 3. Generación ═════════════════════════

-- Nivel dominante ~70 % + relleno ~30 % (fácil→media, media→fácil, difícil→media); si falta, completa con lo que haya.
-- Una sola variante por raíz. Salida agrupada por materia y al azar dentro de cada una.
-- Las respuestas salen como [{ id, texto }]: sin ponderación, diagnóstico ni solución.
create or replace function public.generar_examen_libre(p_carrera text, p_nivel text, p_total integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_relleno text;
  v_dominante integer;
  v_out jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para presentar un examen.' using errcode = '42501';
  end if;
  if p_nivel not in ('facil', 'media', 'dificil') then
    raise exception 'Nivel inválido: %.', p_nivel using errcode = '22023';
  end if;
  if p_total is null or p_total < 1 or p_total > 140 then
    raise exception 'El examen lleva de 1 a 140 preguntas.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.carreras c join public.instituciones i on i.id = c.institucion_id
    where c.id = p_carrera and c.activo and i.activo
  ) then
    raise exception 'La carrera no está disponible.' using errcode = '23503';
  end if;

  v_relleno := case p_nivel when 'media' then 'facil' else 'media' end;
  v_dominante := ceil(p_total * 0.7);

  with base as (
    select distinct on (regexp_replace(r.codigo, '-V[0-9]+$', ''))
      r.id, r.codigo, r.materia_clave, r.dificultad, r.valor_puntos, r.lectura_id, r.pregunta, r.respuestas
    from public.reactivos r
    join public.reactivo_carreras rc on rc.reactivo_id = r.id and rc.carrera_id = p_carrera
    order by regexp_replace(r.codigo, '-V[0-9]+$', ''), random()
  ),
  ranked as (
    select b.*, random() as rnd,
      row_number() over (partition by b.dificultad order by random()) as n
    from base b
  ),
  elegidos as (
    select k.*
    from ranked k
    order by
      case
        when k.dificultad = p_nivel and k.n <= v_dominante then 0
        when k.dificultad = v_relleno and k.n <= p_total - v_dominante then 1
        else 2
      end,
      k.dificultad = p_nivel desc,
      k.rnd
    limit p_total
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'codigo', e.codigo,
    'materia', e.materia_clave,
    'materia_nombre', m.nombre,
    'dificultad', e.dificultad,
    'valor_puntos', e.valor_puntos,
    'lectura', l.texto,
    'pregunta', e.pregunta,
    'respuestas', (
      select jsonb_agg(jsonb_build_object('id', x->'id', 'texto', x->'texto') order by (x->>'id')::int)
      from jsonb_array_elements(e.respuestas) x
    )
  ) order by m.nombre, e.rnd), '[]')
  into v_out
  from elegidos e
  join public.materias m on m.clave = e.materia_clave
  left join public.lecturas l on l.id = e.lectura_id;

  return v_out;
end;
$$;

-- ═════════════════════════ 4. Calificación y congelamiento ═════════════════════════

-- p_respuestas (en el orden del examen): [{ codigo, respuesta_id (null = sin responder), segundos, orden: [ids] }]
-- Devuelve el id de exam_history.
create or replace function public.guardar_examen_libre(
  p_carrera text,
  p_nivel text,
  p_respuestas jsonb,
  p_tiempo_limite integer,
  p_tiempo_usado integer,
  p_agotado boolean,
  p_aviso_aceptado boolean
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_carrera record;
  v_esperadas integer;
  v_snapshot jsonb;
  v_encontradas integer;
  v_resumen jsonb;
  v_puntos numeric;
  v_maximo numeric;
  v_respondidas integer;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para guardar tu examen.' using errcode = '42501';
  end if;
  if p_aviso_aceptado is not true then
    raise exception 'Debes aceptar el aviso antes de presentar el examen.' using errcode = '22023';
  end if;
  if p_nivel not in ('facil', 'media', 'dificil') then
    raise exception 'Nivel inválido: %.', p_nivel using errcode = '22023';
  end if;
  if jsonb_typeof(p_respuestas) <> 'array' or jsonb_array_length(p_respuestas) = 0 then
    raise exception 'El examen no tiene preguntas.' using errcode = '22023';
  end if;

  select c.id, c.nombre, a.nombre as area, i.clave, i.nombre as institucion, i.color_id
  into v_carrera
  from public.carreras c
  join public.instituciones i on i.id = c.institucion_id
  left join public.areas a on a.id = c.area_id
  where c.id = p_carrera;
  if v_carrera.id is null then
    raise exception 'La carrera no existe.' using errcode = '23503';
  end if;

  v_esperadas := jsonb_array_length(p_respuestas);

  -- Fotografía exacta de cada reactivo (solo los asignados a la carrera: no se aceptan preguntas ajenas).
  with entrada as (
    select e.ord,
      e.item->>'codigo' as codigo,
      nullif(e.item->>'respuesta_id', '')::int as respuesta_id,
      least(greatest(coalesce((e.item->>'segundos')::int, 0), 0), 86400) as segundos,
      coalesce(e.item->'orden', '[]') as orden
    from jsonb_array_elements(p_respuestas) with ordinality as e(item, ord)
  ),
  filas as (
    select en.*, r.materia_clave, m.nombre as materia_nombre, r.dificultad, r.valor_puntos, r.fuente_detallada,
      l.texto as lectura, r.pregunta, r.respuestas, r.solucion,
      (select x from jsonb_array_elements(r.respuestas) x where (x->>'id')::int = en.respuesta_id) as elegida
    from entrada en
    join public.reactivos r on r.codigo = en.codigo
    join public.reactivo_carreras rc on rc.reactivo_id = r.id and rc.carrera_id = p_carrera
    join public.materias m on m.clave = r.materia_clave
    left join public.lecturas l on l.id = r.lectura_id
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'id_original', f.codigo,
    'materia', f.materia_nombre,
    'materia_clave', f.materia_clave,
    'dificultad', f.dificultad,
    'valor_puntos', f.valor_puntos,
    'fuente_detallada', f.fuente_detallada,
    'lectura', f.lectura,
    'pregunta', f.pregunta,
    'respuestas', f.respuestas,
    'orden_opciones', f.orden,
    'respuesta_seleccionada_id', case when f.elegida is null then null else f.respuesta_id end,
    'ponderacion_obtenida', coalesce((f.elegida->>'ponderacion')::numeric, 0),
    'diagnostico_error', f.elegida->'diagnosticoError',
    'solucion_paso_a_paso', f.solucion,
    'tiempo_respuesta_segundos', f.segundos
  ) order by f.ord), '[]')
  into v_encontradas, v_snapshot
  from filas f;

  if v_encontradas <> v_esperadas then
    raise exception 'Alguna pregunta ya no está disponible para esta carrera.' using errcode = '23503';
  end if;

  select
    coalesce(sum((q->>'ponderacion_obtenida')::numeric * (q->>'valor_puntos')::numeric), 0),
    coalesce(sum((q->>'valor_puntos')::numeric), 0),
    count(*) filter (where q->>'respuesta_seleccionada_id' is not null)
  into v_puntos, v_maximo, v_respondidas
  from jsonb_array_elements(v_snapshot) q;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.materia), '[]')
  into v_resumen
  from (
    select q->>'materia' as materia,
      q->>'materia_clave' as materia_clave,
      count(*) as total,
      count(*) filter (where (q->>'ponderacion_obtenida')::numeric >= 1) as correctas,
      count(*) filter (where (q->>'ponderacion_obtenida')::numeric > 0 and (q->>'ponderacion_obtenida')::numeric < 1) as parciales,
      count(*) filter (where q->>'respuesta_seleccionada_id' is not null and (q->>'ponderacion_obtenida')::numeric = 0) as incorrectas,
      count(*) filter (where q->>'respuesta_seleccionada_id' is null) as sin_responder,
      sum((q->>'ponderacion_obtenida')::numeric * (q->>'valor_puntos')::numeric) as puntos,
      sum((q->>'valor_puntos')::numeric) as maximo,
      round(100.0 * count(*) filter (where (q->>'ponderacion_obtenida')::numeric >= 1) / count(*), 1) as porcentaje_aciertos
    from jsonb_array_elements(v_snapshot) q
    group by q->>'materia', q->>'materia_clave'
  ) x;

  insert into public.exam_history (
    student_id, exam_type, university_key, university_name, career_id, career_name, level,
    total_questions, answered_questions, score_achieved, max_score,
    time_limit_seconds, time_spent_seconds, timed_out, frozen_exam_data
  ) values (
    v_uid, 'libre', v_carrera.clave, v_carrera.institucion, v_carrera.id, v_carrera.nombre, p_nivel,
    v_esperadas, v_respondidas, v_puntos, v_maximo,
    greatest(coalesce(p_tiempo_limite, 1), 1), least(greatest(coalesce(p_tiempo_usado, 0), 0), greatest(coalesce(p_tiempo_limite, 1), 1)),
    coalesce(p_agotado, false),
    jsonb_build_object(
      'disclaimer_accepted', true,
      'institucion', jsonb_build_object('clave', v_carrera.clave, 'nombre', v_carrera.institucion, 'color_id', v_carrera.color_id),
      'carrera', jsonb_build_object('id', v_carrera.id, 'nombre', v_carrera.nombre, 'area', v_carrera.area),
      'resumen_por_materia', v_resumen,
      'questions_snapshot', v_snapshot
    )
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.opciones_examen_libre() from public, anon;
revoke execute on function public.generar_examen_libre(text, text, integer) from public, anon;
revoke execute on function public.guardar_examen_libre(text, text, jsonb, integer, integer, boolean, boolean) from public, anon;
revoke execute on function public.exam_history_inmutable() from public, anon, authenticated;
grant execute on function public.opciones_examen_libre() to authenticated;
grant execute on function public.generar_examen_libre(text, text, integer) to authenticated;
grant execute on function public.guardar_examen_libre(text, text, jsonb, integer, integer, boolean, boolean) to authenticated;

commit;
