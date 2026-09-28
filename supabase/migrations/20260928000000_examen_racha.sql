-- Entrena Mente · Examen Racha (micro examen tipo trivia).
--
-- Se corre DESPUÉS de 20260927050000_folio_examen.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Sin tablas nuevas: la racha usa el mismo exam_history (exam_type = 'racha') y la misma calificación en la base.
--
-- Qué agrega:
--   · congelar_examen(): la calificación y la "fotografía" que antes vivían en guardar_examen_libre(), ahora con el
--     tipo como parámetro. Es interna: solo la llaman las funciones guardar_*; el alumno no puede ejecutarla.
--   · guardar_examen_libre(): mismo contrato de siempre; ahora delega en congelar_examen('libre', …).
--   · nivel_racha(): el nivel sale del último examen racha de esa carrera. Empieza en fácil; si lo aprobó
--     (≥ 70 % de los puntos) sube un nivel, si no, baja uno. Nunca baja de fácil ni sube de difícil.
--   · generar_examen_racha(): 2 preguntas por materia de la carrera, del nivel que le toca (si una materia no tiene
--     suficientes, completa con la dificultad más cercana), alternadas por materia como trivia.
--   · guardar_examen_racha(): valida que el nivel sea el que le tocaba y congela con exam_type = 'racha'.

begin;

-- ═════════════════════════ 1. Calificación y congelamiento (compartida) ═════════════════════════

-- p_respuestas (en el orden del examen): [{ codigo, respuesta_id (null = sin responder), segundos, orden: [ids] }]
-- Devuelve el id de exam_history.
create or replace function public.congelar_examen(
  p_tipo text,
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
  if p_tipo not in ('libre', 'plan', 'racha') then
    raise exception 'Tipo de examen inválido: %.', p_tipo using errcode = '22023';
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
    v_uid, p_tipo, v_carrera.clave, v_carrera.institucion, v_carrera.id, v_carrera.nombre, p_nivel,
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

-- Mismo contrato que antes: el cliente del Examen Libre no cambia.
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
language sql
volatile
security definer
set search_path = ''
as $$
  select public.congelar_examen('libre', p_carrera, p_nivel, p_respuestas, p_tiempo_limite, p_tiempo_usado, p_agotado, p_aviso_aceptado);
$$;

-- ═════════════════════════ 2. Nivel de la racha ═════════════════════════

-- Aprobar = ≥ 70 % de los puntos del examen (mismo umbral que RACHA_APRUEBA en src/features/exam/lib/racha.ts).
create or replace function public.nivel_racha(p_carrera text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when h.max_score > 0 and h.score_achieved / h.max_score >= 0.7
        then case h.level when 'facil' then 'media' else 'dificil' end
      else case h.level when 'dificil' then 'media' else 'facil' end
    end
    from public.exam_history h
    where h.student_id = (select auth.uid()) and h.exam_type = 'racha' and h.career_id = p_carrera
    order by h.completed_at desc, h.id desc
    limit 1
  ), 'facil');
$$;

-- ═════════════════════════ 3. Generación ═════════════════════════

-- Devuelve { nivel, anterior: { nivel, porcentaje } | null, preguntas: [...] }.
-- 2 por materia (una variante por raíz), la dificultad del nivel primero y luego la más cercana.
-- Orden de trivia: primera ronda una de cada materia, segunda ronda la otra; materias en orden al azar.
create or replace function public.generar_examen_racha(p_carrera text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nivel text;
  v_anterior jsonb;
  v_items jsonb;
  v_escala text[] := array['facil', 'media', 'dificil'];
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para jugar tu racha.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.carreras c join public.instituciones i on i.id = c.institucion_id
    where c.id = p_carrera and c.activo and i.activo
  ) then
    raise exception 'La carrera no está disponible.' using errcode = '23503';
  end if;

  v_nivel := public.nivel_racha(p_carrera);

  select jsonb_build_object(
    'nivel', h.level,
    'porcentaje', case when h.max_score > 0 then round(100 * h.score_achieved / h.max_score, 1) else 0 end
  )
  into v_anterior
  from public.exam_history h
  where h.student_id = (select auth.uid()) and h.exam_type = 'racha' and h.career_id = p_carrera
  order by h.completed_at desc, h.id desc
  limit 1;

  with base as (
    select distinct on (regexp_replace(r.codigo, '-V[0-9]+$', ''))
      r.id, r.codigo, r.materia_clave, r.dificultad, r.valor_puntos, r.lectura_id, r.pregunta, r.respuestas
    from public.reactivos r
    join public.reactivo_carreras rc on rc.reactivo_id = r.id and rc.carrera_id = p_carrera
    order by regexp_replace(r.codigo, '-V[0-9]+$', ''), random()
  ),
  ranked as (
    select b.*,
      row_number() over (
        partition by b.materia_clave
        order by abs(array_position(v_escala, b.dificultad) - array_position(v_escala, v_nivel)), random()
      ) as ronda
    from base b
  ),
  materias_azar as (
    select x.materia_clave, random() as rnd
    from (select distinct materia_clave from ranked) x
  ),
  elegidos as (
    select k.*, ma.rnd as materia_rnd
    from ranked k
    join materias_azar ma on ma.materia_clave = k.materia_clave
    where k.ronda <= 2
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
  ) order by e.ronda, e.materia_rnd), '[]')
  into v_items
  from elegidos e
  join public.materias m on m.clave = e.materia_clave
  left join public.lecturas l on l.id = e.lectura_id;

  return jsonb_build_object('nivel', v_nivel, 'anterior', v_anterior, 'preguntas', v_items);
end;
$$;

-- ═════════════════════════ 4. Guardado ═════════════════════════

create or replace function public.guardar_examen_racha(
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
begin
  -- El nivel no lo elige el alumno: debe ser el que le tocaba (evita guardar una racha "difícil" a mano).
  if p_nivel is distinct from public.nivel_racha(p_carrera) then
    raise exception 'Tu nivel de racha cambió mientras jugabas. Vuelve a empezar.' using errcode = '22023';
  end if;
  return public.congelar_examen('racha', p_carrera, p_nivel, p_respuestas, p_tiempo_limite, p_tiempo_usado, p_agotado, p_aviso_aceptado);
end;
$$;

revoke execute on function public.congelar_examen(text, text, text, jsonb, integer, integer, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.nivel_racha(text) from public, anon;
revoke execute on function public.generar_examen_racha(text) from public, anon;
revoke execute on function public.guardar_examen_racha(text, text, jsonb, integer, integer, boolean, boolean) from public, anon;
grant execute on function public.nivel_racha(text) to authenticated;
grant execute on function public.generar_examen_racha(text) to authenticated;
grant execute on function public.guardar_examen_racha(text, text, jsonb, integer, integer, boolean, boolean) to authenticated;

commit;
