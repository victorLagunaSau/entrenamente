-- Módulo TOEFL ITP · fase 2: examen diagnóstico express (15:00, 10–12 preguntas).
--
-- Se corre DESPUÉS de 20261031000000_toefl_itp.sql.
--
--   · exam_history acepta los tipos TOEFL (toefl_diagnostico ahora; practica/plan/racha en la fase 3) y,
--     para ellos, el nivel es MCER (A1–C2) en lugar de facil/media/dificil.
--   · El candado de pruebas gratis (consumir_prueba_gratis) ya no aplica a TOEFL: tiene su propia regla.
--     Diagnóstico: sin licencia, uno; con licencia (o admin), los que quiera.
--   · generar_diagnostico_toefl(): 2 preguntas por nivel MCER (secciones distintas, una variante por semilla),
--     del rango de edad del alumno; nunca envía ponderaciones ni diagnósticos.
--   · guardar_diagnostico_toefl(): califica en la base, congela el intento en exam_history y fija
--     profiles.current_mcer_level = el nivel más alto aprobado (≥ 50 %) sin saltarse niveles.
--   · estado_toefl(): lo que necesita el home TOEFL del alumno.

begin;

-- ═════════════════════════ 1. exam_history acepta TOEFL ═════════════════════════

alter table public.exam_history drop constraint if exists exam_history_exam_type_check;
alter table public.exam_history add constraint exam_history_exam_type_check
  check (exam_type in ('libre', 'plan', 'racha', 'toefl_diagnostico', 'toefl_practica', 'toefl_plan', 'toefl_racha'));

alter table public.exam_history drop constraint if exists exam_history_level_check;
alter table public.exam_history add constraint exam_history_level_check
  check (
    (exam_type like 'toefl\_%' and level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
    or (exam_type not like 'toefl\_%' and level in ('facil', 'media', 'dificil'))
  );

-- Las pruebas gratis son del Examen Libre de admisión; TOEFL valida su acceso en sus propias funciones.
drop trigger if exists exam_history_consumir_prueba on public.exam_history;
create trigger exam_history_consumir_prueba before insert on public.exam_history
  for each row when (new.exam_type not like 'toefl\_%')
  execute function public.consumir_prueba_gratis();

-- ═════════════════════════ 2. Acceso ═════════════════════════

create or replace function public.exigir_diagnostico_toefl()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para presentar el diagnóstico.' using errcode = '42501';
  end if;
  if coalesce((select status from public.get_my_access()), 'inactive') <> 'active'
     and exists (select 1 from public.exam_history
                 where student_id = (select auth.uid()) and exam_type = 'toefl_diagnostico') then
    raise exception 'Ya hiciste tu diagnóstico TOEFL gratis. Desbloquea el acceso ilimitado para repetirlo.'
      using errcode = 'P0402';
  end if;
end;
$$;
revoke execute on function public.exigir_diagnostico_toefl() from public, anon, authenticated;

-- ═════════════════════════ 3. Generar ═════════════════════════

-- [{ id, section, mcer_level, question_text, options: [{ id, texto }],
--    context: { id, audio_url, audio_max_plays, reading_passage } | null }]
-- Orden TOEFL ITP: Listening → Structure → Reading; dentro de cada sección, de menor a mayor nivel.
create or replace function public.generar_diagnostico_toefl()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_age public.toefl_age_range;
  v_pool integer;
  v_out jsonb;
begin
  perform public.exigir_diagnostico_toefl();

  select target_toefl_age_range into v_age from public.profiles where id = (select auth.uid());

  select count(distinct seed_code) into v_pool
  from public.toefl_questions where is_active and age_range = v_age;
  if v_pool < 6 then
    raise exception 'Aún no hay suficientes preguntas TOEFL para tu rango de edad. Vuelve pronto.' using errcode = 'P0002';
  end if;

  with raices as (
    -- Una variante al azar por semilla.
    select distinct on (q.seed_code) q.*
    from public.toefl_questions q
    where q.is_active and q.age_range = v_age
    order by q.seed_code, random()
  ),
  por_seccion as (
    select r.*, row_number() over (partition by r.mcer_level, r.section order by random()) as rs from raices r
  ),
  por_nivel as (
    -- Primero una de cada sección dentro del nivel, luego repite sección.
    select p.*, row_number() over (partition by p.mcer_level order by p.rs, random()) as rn from por_seccion p
  ),
  base as (
    select * from por_nivel where rn <= 2
  ),
  relleno as (
    select * from por_nivel where rn > 2
    order by random()
    limit greatest(0, 10 - (select count(*) from base))
  ),
  elegidas as (
    select * from base union all select * from relleno
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'section', e.section,
    'mcer_level', e.mcer_level,
    'question_text', e.question_text,
    'options', (select jsonb_agg(jsonb_build_object('id', o->>'id', 'texto', o->>'texto') order by ord)
                from jsonb_array_elements(e.options) with ordinality as x(o, ord)),
    'context', case when a.id is null then null else jsonb_build_object(
      'id', a.id,
      'audio_url', a.audio_url,
      'audio_max_plays', a.audio_max_plays,
      'reading_passage', a.reading_passage
    ) end
  ) order by array_position(array['listening', 'structure', 'reading'], e.section::text), e.mcer_level, a.id, e.id), '[]'::jsonb)
  into v_out
  from elegidas e
  left join public.toefl_context_assets a on a.id = e.context_asset_id;

  return v_out;
end;
$$;

revoke execute on function public.generar_diagnostico_toefl() from public, anon;
grant execute on function public.generar_diagnostico_toefl() to authenticated;

-- ═════════════════════════ 4. Calificar y congelar ═════════════════════════

-- p_respuestas: [{ id, respuesta_id (letra o null), segundos }] en el orden del examen.
create or replace function public.guardar_diagnostico_toefl(
  p_respuestas jsonb,
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
  c_limite constant integer := 900;
  v_age public.toefl_age_range;
  v_anterior public.mcer_level;
  v_esperadas integer;
  v_encontradas integer;
  v_snapshot jsonb;
  v_por_nivel jsonb;
  v_por_seccion jsonb;
  v_puntos numeric;
  v_respondidas integer;
  v_nivel public.mcer_level := 'A1';
  v_fila record;
  v_id bigint;
begin
  perform public.exigir_diagnostico_toefl();
  if p_aviso_aceptado is not true then
    raise exception 'Debes aceptar las indicaciones antes de presentar el diagnóstico.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_respuestas) <> 'array' or jsonb_array_length(p_respuestas) not between 6 and 20 then
    raise exception 'El diagnóstico debe tener entre 6 y 20 preguntas.' using errcode = '22023';
  end if;
  if (select count(distinct e->>'id') from jsonb_array_elements(p_respuestas) e) <> jsonb_array_length(p_respuestas) then
    raise exception 'El diagnóstico repite preguntas.' using errcode = '22023';
  end if;

  select target_toefl_age_range, current_mcer_level into v_age, v_anterior
  from public.profiles where id = v_uid for update;

  v_esperadas := jsonb_array_length(p_respuestas);

  with entrada as (
    select x.ord,
      x.item->>'id' as id,
      nullif(x.item->>'respuesta_id', '') as respuesta_id,
      least(greatest(coalesce((x.item->>'segundos')::int, 0), 0), 86400) as segundos
    from jsonb_array_elements(p_respuestas) with ordinality as x(item, ord)
  ),
  filas as (
    select en.*, q.section, q.mcer_level, q.question_text, q.options,
      q.step_by_step_explanation_es, q.step_by_step_explanation_en,
      a.audio_url, a.reading_passage, a.transcription_audio,
      (select o from jsonb_array_elements(q.options) o where o->>'id' = en.respuesta_id) as elegida
    from entrada en
    join public.toefl_questions q on q.id = en.id and q.age_range = v_age
    left join public.toefl_context_assets a on a.id = q.context_asset_id
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'id_original', f.id,
    'section', f.section,
    'mcer_level', f.mcer_level,
    'audio_url', f.audio_url,
    'reading_passage', f.reading_passage,
    'transcription', f.transcription_audio,
    'pregunta', f.question_text,
    'respuestas', f.options,
    'respuesta_seleccionada_id', case when f.elegida is null then null else f.respuesta_id end,
    'ponderacion_obtenida', coalesce((f.elegida->>'ponderacion')::numeric, 0),
    'diagnostico_error_es', f.elegida->'diagnosticoError_es',
    'diagnostico_error_en', f.elegida->'diagnosticoError_en',
    'solucion_es', f.step_by_step_explanation_es,
    'solucion_en', f.step_by_step_explanation_en,
    'tiempo_respuesta_segundos', f.segundos
  ) order by f.ord), '[]'::jsonb)
  into v_encontradas, v_snapshot
  from filas f;

  if v_encontradas <> v_esperadas then
    raise exception 'Alguna pregunta ya no está disponible.' using errcode = '23503';
  end if;

  select coalesce(sum((q->>'ponderacion_obtenida')::numeric), 0),
         count(*) filter (where q->>'respuesta_seleccionada_id' is not null)
  into v_puntos, v_respondidas
  from jsonb_array_elements(v_snapshot) q;

  -- Desglose por nivel MCER (aciertos = ponderación 1).
  select coalesce(jsonb_agg(to_jsonb(x) order by x.nivel), '[]'::jsonb) into v_por_nivel
  from (
    select q->>'mcer_level' as nivel,
      count(*) as total,
      count(*) filter (where (q->>'ponderacion_obtenida')::numeric >= 1) as correctas,
      round(100.0 * count(*) filter (where (q->>'ponderacion_obtenida')::numeric >= 1) / count(*), 1) as porcentaje_aciertos
    from jsonb_array_elements(v_snapshot) q
    group by q->>'mcer_level'
  ) x;

  -- Desglose por sección, con la misma forma que resumen_por_materia de los demás exámenes.
  select coalesce(jsonb_agg(to_jsonb(x) order by array_position(array['listening', 'structure', 'reading'], x.materia_clave)), '[]'::jsonb)
  into v_por_seccion
  from (
    select initcap(q->>'section') as materia,
      q->>'section' as materia_clave,
      count(*) as total,
      count(*) filter (where (q->>'ponderacion_obtenida')::numeric >= 1) as correctas,
      count(*) filter (where (q->>'ponderacion_obtenida')::numeric > 0 and (q->>'ponderacion_obtenida')::numeric < 1) as parciales,
      count(*) filter (where q->>'respuesta_seleccionada_id' is not null and (q->>'ponderacion_obtenida')::numeric = 0) as incorrectas,
      count(*) filter (where q->>'respuesta_seleccionada_id' is null) as sin_responder,
      sum((q->>'ponderacion_obtenida')::numeric) as puntos,
      count(*) as maximo,
      round(100.0 * count(*) filter (where (q->>'ponderacion_obtenida')::numeric >= 1) / count(*), 1) as porcentaje_aciertos
    from jsonb_array_elements(v_snapshot) q
    group by q->>'section'
  ) x;

  -- Ubicación: sube nivel por nivel mientras apruebe (≥ 50 %); un nivel sin preguntas no corta la escalera.
  for v_fila in
    select n.lvl, (select (x->>'porcentaje_aciertos')::numeric from jsonb_array_elements(v_por_nivel) x where x->>'nivel' = n.lvl::text) as pct
    from unnest(enum_range(null::public.mcer_level)) as n(lvl)
  loop
    continue when v_fila.pct is null;
    exit when v_fila.pct < 50;
    v_nivel := v_fila.lvl;
  end loop;

  update public.student_profiles set first_activity_at = now()
  where user_id = v_uid and first_activity_at is null;

  insert into public.exam_history (
    student_id, exam_type, university_key, university_name, career_id, career_name, level,
    total_questions, answered_questions, score_achieved, max_score,
    time_limit_seconds, time_spent_seconds, timed_out, frozen_exam_data
  ) values (
    v_uid, 'toefl_diagnostico', 'TOEFL', 'TOEFL ITP', null, 'Diagnóstico TOEFL ITP', v_nivel::text,
    v_esperadas, v_respondidas, v_puntos, v_esperadas,
    c_limite, least(greatest(coalesce(p_tiempo_usado, 0), 0), c_limite), coalesce(p_agotado, false),
    jsonb_build_object(
      'disclaimer_accepted', true,
      'institucion', jsonb_build_object('clave', 'TOEFL', 'nombre', 'TOEFL ITP', 'color_id', 'toefl'),
      'toefl', jsonb_build_object('age_range', v_age, 'nivel_anterior', v_anterior, 'nivel_asignado', v_nivel),
      'resumen_por_nivel', v_por_nivel,
      'resumen_por_materia', v_por_seccion,
      'questions_snapshot', v_snapshot
    )
  )
  returning id into v_id;

  update public.profiles set current_mcer_level = v_nivel where id = v_uid;

  return v_id;
end;
$$;

revoke execute on function public.guardar_diagnostico_toefl(jsonb, integer, boolean, boolean) from public, anon;
grant execute on function public.guardar_diagnostico_toefl(jsonb, integer, boolean, boolean) to authenticated;

-- ═════════════════════════ 5. Estado del alumno ═════════════════════════

create or replace function public.estado_toefl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_age public.toefl_age_range;
  v_nivel public.mcer_level;
  v_activo boolean;
  v_diagnosticos integer;
begin
  if v_uid is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  select target_toefl_age_range, current_mcer_level into v_age, v_nivel from public.profiles where id = v_uid;
  v_activo := coalesce((select status from public.get_my_access()), 'inactive') = 'active';
  select count(*) into v_diagnosticos from public.exam_history where student_id = v_uid and exam_type = 'toefl_diagnostico';

  return jsonb_build_object(
    'age_range', v_age,
    'nivel', v_nivel,
    'acceso_ilimitado', v_activo,
    'diagnosticos', v_diagnosticos,
    'puede_diagnostico', v_activo or v_diagnosticos = 0,
    'preguntas_disponibles', (select count(distinct seed_code) from public.toefl_questions where is_active and age_range = v_age),
    'historial', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'folio', e.folio, 'tipo', e.exam_type, 'nivel', e.level,
        'aciertos', round(100.0 * e.score_achieved / nullif(e.max_score, 0)), 'fecha', e.completed_at
      ) order by e.completed_at desc)
      from (select * from public.exam_history
            where student_id = v_uid and exam_type like 'toefl\_%'
            order by completed_at desc limit 20) e
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.estado_toefl() from public, anon;
grant execute on function public.estado_toefl() to authenticated;

commit;
