-- Módulo TOEFL ITP · fase 3: práctica libre, plan semanal y racha diaria, con subida de nivel.
--
-- Se corre DESPUÉS de 20261101000000_toefl_diagnostico.sql.
--
--   · Carga de reactivos: 60 % del nivel actual del alumno + 40 % del nivel inmediato superior
--     (en C2, todo C2). Si falta de un nivel se completa con el otro y luego con el inferior.
--     Una variante por semilla; primero las que no vio en sus últimos 3 intentos TOEFL.
--   · Práctica y plan: 30 a 40 minutos (60 s por pregunta, hasta 40 preguntas). Racha: 5 preguntas, 10:00.
--   · Subida de nivel: ≥ 80 % de aciertos en las preguntas del nivel superior en 2 simulacros seguidos
--     (práctica o plan) al mismo nivel → current_mcer_level sube UN nivel (A2 → B1).
--   · Plan: días de la semana + fecha del examen opcional; una sesión por día de plan (hoy = Ciudad de México).
--   · Racha: una por día; los días seguidos se cuentan desde exam_history.
--   · Todo esto es del acceso ilimitado (con licencia o admin) y pide haber hecho el diagnóstico.

begin;

-- ═════════════════════════ 1. Plan ═════════════════════════

create table public.toefl_plans (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  exam_date date,
  -- Días ISO: 1 = lunes … 7 = domingo.
  dias smallint[] not null check (cardinality(dias) between 1 and 7 and dias <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger toefl_plans_touch before update on public.toefl_plans
  for each row execute function public.touch_updated_at();

alter table public.toefl_plans enable row level security;
revoke all on public.toefl_plans from anon, authenticated;
grant select on public.toefl_plans to authenticated;
create policy "toefl plan: dueño o admin ve" on public.toefl_plans
  for select to authenticated using (student_id = (select auth.uid()) or public.is_admin());

-- ═════════════════════════ 2. Utilidades internas ═════════════════════════

create or replace function public.toefl_nivel_vecino(p_nivel public.mcer_level, p_paso integer)
returns public.mcer_level
language sql immutable set search_path = ''
as $$
  select (enum_range(null::public.mcer_level))[array_position(enum_range(null::public.mcer_level), p_nivel) + p_paso];
$$;

-- Fecha (Ciudad de México) de un intento.
create or replace function public.toefl_dia(p_ts timestamptz)
returns date
language sql immutable set search_path = ''
as $$
  select (p_ts at time zone 'America/Mexico_City')::date;
$$;

-- Candado común. Devuelve el nivel actual del alumno.
create or replace function public.exigir_examen_toefl(p_tipo text)
returns public.mcer_level
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_nivel public.mcer_level;
  v_plan public.toefl_plans;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para presentar un examen.' using errcode = '42501';
  end if;
  if p_tipo not in ('toefl_practica', 'toefl_plan', 'toefl_racha') then
    raise exception 'Tipo de examen inválido: %.', p_tipo using errcode = '22023';
  end if;
  if coalesce((select status from public.get_my_access()), 'inactive') <> 'active' then
    raise exception 'La práctica, el plan y la racha TOEFL son parte del acceso ilimitado.' using errcode = 'P0402';
  end if;

  select current_mcer_level into v_nivel from public.profiles where id = v_uid;
  if v_nivel is null then
    raise exception 'Primero presenta tu diagnóstico TOEFL para conocer tu nivel.' using errcode = 'P0001';
  end if;

  if p_tipo = 'toefl_racha' and exists (
    select 1 from public.exam_history
    where student_id = v_uid and exam_type = 'toefl_racha' and public.toefl_dia(completed_at) = public.hoy_mx()
  ) then
    raise exception 'Ya hiciste tu racha de hoy. Vuelve mañana.' using errcode = 'P0001';
  end if;

  if p_tipo = 'toefl_plan' then
    select * into v_plan from public.toefl_plans where student_id = v_uid;
    if v_plan.student_id is null then
      raise exception 'Aún no tienes un plan TOEFL.' using errcode = 'P0001';
    end if;
    if not (extract(isodow from public.hoy_mx())::smallint = any (v_plan.dias)) then
      raise exception 'Hoy no te toca sesión de tu plan.' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.exam_history
      where student_id = v_uid and exam_type = 'toefl_plan' and public.toefl_dia(completed_at) = public.hoy_mx()
    ) then
      raise exception 'Ya hiciste la sesión de hoy de tu plan.' using errcode = 'P0001';
    end if;
  end if;

  return v_nivel;
end;
$$;

-- Tiempo del examen según tipo y número de preguntas.
create or replace function public.toefl_tiempo(p_tipo text, p_total integer)
returns integer
language sql immutable set search_path = ''
as $$
  select case when p_tipo = 'toefl_racha' then 600 else least(greatest(p_total * 60, 1800), 2400) end;
$$;

-- Preguntas listas para el alumno (sin ponderaciones), en orden TOEFL ITP.
create or replace function public.toefl_items(p_ids text[])
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'section', q.section,
    'mcer_level', q.mcer_level,
    'question_text', q.question_text,
    'options', (select jsonb_agg(jsonb_build_object('id', o->>'id', 'texto', o->>'texto') order by ord)
                from jsonb_array_elements(q.options) with ordinality as x(o, ord)),
    'context', case when a.id is null then null else jsonb_build_object(
      'id', a.id, 'audio_url', a.audio_url, 'audio_max_plays', a.audio_max_plays, 'reading_passage', a.reading_passage
    ) end
  ) order by array_position(array['listening', 'structure', 'reading'], q.section::text), q.mcer_level, a.id, q.id), '[]'::jsonb)
  from public.toefl_questions q
  left join public.toefl_context_assets a on a.id = q.context_asset_id
  where q.id = any (p_ids);
$$;

-- Califica: fotografía + desgloses. { encontradas, respondidas, puntos, snapshot, por_nivel, por_seccion }
create or replace function public.toefl_calificar(p_respuestas jsonb, p_age public.toefl_age_range)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_snapshot jsonb;
  v_encontradas integer;
  v_por_nivel jsonb;
  v_por_seccion jsonb;
begin
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
    join public.toefl_questions q on q.id = en.id and q.age_range = p_age
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

  select coalesce(jsonb_agg(to_jsonb(x) order by x.nivel), '[]'::jsonb) into v_por_nivel
  from (
    select q->>'mcer_level' as nivel,
      count(*) as total,
      count(*) filter (where (q->>'ponderacion_obtenida')::numeric >= 1) as correctas,
      round(100.0 * count(*) filter (where (q->>'ponderacion_obtenida')::numeric >= 1) / count(*), 1) as porcentaje_aciertos
    from jsonb_array_elements(v_snapshot) q
    group by q->>'mcer_level'
  ) x;

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

  return jsonb_build_object(
    'encontradas', v_encontradas,
    'respondidas', (select count(*) from jsonb_array_elements(v_snapshot) q where q->>'respuesta_seleccionada_id' is not null),
    'puntos', (select coalesce(sum((q->>'ponderacion_obtenida')::numeric), 0) from jsonb_array_elements(v_snapshot) q),
    'snapshot', v_snapshot,
    'por_nivel', v_por_nivel,
    'por_seccion', v_por_seccion
  );
end;
$$;

revoke execute on function public.exigir_examen_toefl(text) from public, anon, authenticated;
revoke execute on function public.toefl_items(text[]) from public, anon, authenticated;
revoke execute on function public.toefl_calificar(jsonb, public.toefl_age_range) from public, anon, authenticated;

-- ═════════════════════════ 3. Generar ═════════════════════════

-- { tipo, nivel, nivel_superior, tiempo_limite, items: [...] }
create or replace function public.generar_examen_toefl(p_tipo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_nivel public.mcer_level := public.exigir_examen_toefl(p_tipo);
  v_sup public.mcer_level := public.toefl_nivel_vecino(v_nivel, 1);
  v_inf public.mcer_level := public.toefl_nivel_vecino(v_nivel, -1);
  v_age public.toefl_age_range;
  v_recientes text[];
  v_pool integer;
  v_n integer;
  v_n_sup integer;
  v_minimo integer := case when p_tipo = 'toefl_racha' then 3 else 10 end;
  v_ids text[];
begin
  select target_toefl_age_range into v_age from public.profiles where id = v_uid;

  -- Lo que vio en sus últimos 3 intentos TOEFL va al final de la fila.
  select coalesce(array_agg(distinct s->>'id_original'), '{}') into v_recientes
  from (
    select frozen_exam_data from public.exam_history
    where student_id = v_uid and exam_type like 'toefl\_%'
    order by completed_at desc limit 3
  ) e, jsonb_array_elements(e.frozen_exam_data->'questions_snapshot') s;

  select count(distinct seed_code) into v_pool
  from public.toefl_questions
  where is_active and age_range = v_age and mcer_level in (v_nivel, coalesce(v_sup, v_nivel), coalesce(v_inf, v_nivel));

  v_n := least(case when p_tipo = 'toefl_racha' then 5 else 40 end, v_pool);
  if v_n < v_minimo then
    raise exception 'Aún no hay suficientes preguntas TOEFL de tu nivel (%). Vuelve pronto.', v_nivel using errcode = 'P0002';
  end if;
  v_n_sup := case when v_sup is null then 0 else floor(v_n * 0.4)::int end;

  with cand as (
    select distinct on (q.seed_code) q.id, q.seed_code, q.mcer_level, (q.id = any (v_recientes)) as visto
    from public.toefl_questions q
    where q.is_active and q.age_range = v_age and q.mcer_level in (v_nivel, coalesce(v_sup, v_nivel), coalesce(v_inf, v_nivel))
    order by q.seed_code, (q.id = any (v_recientes)), random()
  ),
  ranked as (
    select c.*, row_number() over (partition by c.mcer_level order by c.visto, random()) as r from cand c
  )
  select array_agg(id) into v_ids
  from (
    select id from ranked
    order by
      case
        when mcer_level = v_nivel and r <= v_n - v_n_sup then 0
        when mcer_level = v_sup and r <= v_n_sup then 0
        when mcer_level in (v_nivel, v_sup) then 1
        else 2
      end,
      visto, random()
    limit v_n
  ) x;

  return jsonb_build_object(
    'tipo', p_tipo,
    'nivel', v_nivel,
    'nivel_superior', v_sup,
    'tiempo_limite', public.toefl_tiempo(p_tipo, cardinality(v_ids)),
    'items', public.toefl_items(v_ids)
  );
end;
$$;

revoke execute on function public.generar_examen_toefl(text) from public, anon;
grant execute on function public.generar_examen_toefl(text) to authenticated;

-- ═════════════════════════ 4. Calificar, congelar y promover ═════════════════════════

-- { id, nivel, promovido, nivel_nuevo }
create or replace function public.guardar_examen_toefl(
  p_tipo text,
  p_respuestas jsonb,
  p_tiempo_usado integer,
  p_agotado boolean,
  p_aviso_aceptado boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_nivel public.mcer_level := public.exigir_examen_toefl(p_tipo);
  v_sup public.mcer_level := public.toefl_nivel_vecino(v_nivel, 1);
  v_age public.toefl_age_range;
  v_total integer;
  v_limite integer;
  v_cal jsonb;
  v_sup_total integer;
  v_pct_sup numeric;
  v_previo jsonb;
  v_promovido boolean := false;
  v_id bigint;
begin
  if p_aviso_aceptado is not true then
    raise exception 'Debes aceptar las indicaciones antes de presentar el examen.' using errcode = '22023';
  end if;
  v_total := case when jsonb_typeof(p_respuestas) = 'array' then jsonb_array_length(p_respuestas) else 0 end;
  if (p_tipo = 'toefl_racha' and v_total not between 3 and 5) or (p_tipo <> 'toefl_racha' and v_total not between 10 and 40) then
    raise exception 'Número de preguntas inválido para este examen.' using errcode = '22023';
  end if;
  if (select count(distinct e->>'id') from jsonb_array_elements(p_respuestas) e) <> v_total then
    raise exception 'El examen repite preguntas.' using errcode = '22023';
  end if;

  select target_toefl_age_range into v_age from public.profiles where id = v_uid for update;
  v_cal := public.toefl_calificar(p_respuestas, v_age);
  if (v_cal->>'encontradas')::int <> v_total then
    raise exception 'Alguna pregunta ya no está disponible.' using errcode = '23503';
  end if;
  v_limite := public.toefl_tiempo(p_tipo, v_total);

  select (x->>'total')::int, (x->>'porcentaje_aciertos')::numeric into v_sup_total, v_pct_sup
  from jsonb_array_elements(v_cal->'por_nivel') x where x->>'nivel' = v_sup::text;

  -- Promoción: este simulacro y el anterior (práctica o plan, al mismo nivel) con ≥ 80 % en el nivel superior.
  if p_tipo in ('toefl_practica', 'toefl_plan') and v_sup is not null and coalesce(v_sup_total, 0) > 0 and v_pct_sup >= 80 then
    select frozen_exam_data->'toefl' into v_previo
    from public.exam_history
    where student_id = v_uid and exam_type in ('toefl_practica', 'toefl_plan')
    order by completed_at desc limit 1;
    v_promovido := v_previo->>'nivel_actual' = v_nivel::text and coalesce((v_previo->>'pct_superior')::numeric, 0) >= 80;
  end if;

  insert into public.exam_history (
    student_id, exam_type, university_key, university_name, career_id, career_name, level,
    total_questions, answered_questions, score_achieved, max_score,
    time_limit_seconds, time_spent_seconds, timed_out, frozen_exam_data
  ) values (
    v_uid, p_tipo, 'TOEFL', 'TOEFL ITP', null,
    case p_tipo when 'toefl_practica' then 'Práctica TOEFL ITP' when 'toefl_plan' then 'Plan TOEFL ITP' else 'Racha TOEFL ITP' end,
    v_nivel::text,
    v_total, (v_cal->>'respondidas')::int, (v_cal->>'puntos')::numeric, v_total,
    v_limite, least(greatest(coalesce(p_tiempo_usado, 0), 0), v_limite), coalesce(p_agotado, false),
    jsonb_build_object(
      'disclaimer_accepted', true,
      'institucion', jsonb_build_object('clave', 'TOEFL', 'nombre', 'TOEFL ITP', 'color_id', 'toefl'),
      'toefl', jsonb_build_object(
        'age_range', v_age,
        'nivel_actual', v_nivel,
        'nivel_superior', v_sup,
        'pct_superior', v_pct_sup,
        'promovido', v_promovido,
        'nivel_nuevo', case when v_promovido then v_sup else v_nivel end
      ),
      'resumen_por_nivel', v_cal->'por_nivel',
      'resumen_por_materia', v_cal->'por_seccion',
      'questions_snapshot', v_cal->'snapshot'
    )
  )
  returning id into v_id;

  if v_promovido then
    update public.profiles set current_mcer_level = v_sup where id = v_uid;
  end if;

  return jsonb_build_object('id', v_id, 'nivel', v_nivel, 'promovido', v_promovido, 'nivel_nuevo', case when v_promovido then v_sup else v_nivel end);
end;
$$;

revoke execute on function public.guardar_examen_toefl(text, jsonb, integer, boolean, boolean) from public, anon;
grant execute on function public.guardar_examen_toefl(text, jsonb, integer, boolean, boolean) to authenticated;

-- ═════════════════════════ 5. Plan ═════════════════════════

create or replace function public.guardar_plan_toefl(p_fecha date, p_dias smallint[])
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  if coalesce((select status from public.get_my_access()), 'inactive') <> 'active' then
    raise exception 'El plan TOEFL es parte del acceso ilimitado.' using errcode = 'P0402';
  end if;
  if p_fecha is not null and p_fecha <= public.hoy_mx() then
    raise exception 'La fecha del examen debe ser posterior a hoy.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_dias), 0) = 0 then
    raise exception 'Elige al menos un día de la semana.' using errcode = '22023';
  end if;

  insert into public.toefl_plans (student_id, exam_date, dias)
  values ((select auth.uid()), p_fecha, (select array_agg(distinct d order by d) from unnest(p_dias) d))
  on conflict (student_id) do update set exam_date = excluded.exam_date, dias = excluded.dias;
end;
$$;

create or replace function public.cancelar_plan_toefl()
returns void
language sql volatile security definer set search_path = ''
as $$
  delete from public.toefl_plans where student_id = (select auth.uid());
$$;

revoke execute on function public.guardar_plan_toefl(date, smallint[]) from public, anon;
grant execute on function public.guardar_plan_toefl(date, smallint[]) to authenticated;
revoke execute on function public.cancelar_plan_toefl() from public, anon;
grant execute on function public.cancelar_plan_toefl() to authenticated;

-- ═════════════════════════ 6. Estado del alumno (amplía la fase 2) ═════════════════════════

create or replace function public.estado_toefl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hoy date := public.hoy_mx();
  v_age public.toefl_age_range;
  v_nivel public.mcer_level;
  v_activo boolean;
  v_diagnosticos integer;
  v_plan public.toefl_plans;
  v_dias_racha date[];
  v_seguidos integer := 0;
  v_dia date;
  v_ultimo jsonb;
begin
  if v_uid is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  select target_toefl_age_range, current_mcer_level into v_age, v_nivel from public.profiles where id = v_uid;
  v_activo := coalesce((select status from public.get_my_access()), 'inactive') = 'active';
  select count(*) into v_diagnosticos from public.exam_history where student_id = v_uid and exam_type = 'toefl_diagnostico';
  select * into v_plan from public.toefl_plans where student_id = v_uid;

  -- Días seguidos de racha: hacia atrás desde hoy (o desde ayer si hoy aún no juega).
  select array_agg(distinct public.toefl_dia(completed_at)) into v_dias_racha
  from public.exam_history where student_id = v_uid and exam_type = 'toefl_racha';
  v_dia := case when v_hoy = any (coalesce(v_dias_racha, '{}')) then v_hoy else v_hoy - 1 end;
  while v_dia = any (coalesce(v_dias_racha, '{}')) loop
    v_seguidos := v_seguidos + 1;
    v_dia := v_dia - 1;
  end loop;

  -- Último simulacro (práctica o plan) para el avance hacia el siguiente nivel.
  select frozen_exam_data->'toefl' into v_ultimo
  from public.exam_history
  where student_id = v_uid and exam_type in ('toefl_practica', 'toefl_plan')
  order by completed_at desc limit 1;

  return jsonb_build_object(
    'age_range', v_age,
    'nivel', v_nivel,
    'acceso_ilimitado', v_activo,
    'diagnosticos', v_diagnosticos,
    'puede_diagnostico', v_activo or v_diagnosticos = 0,
    'preguntas_disponibles', (select count(distinct seed_code) from public.toefl_questions where is_active and age_range = v_age),
    'promocion', case when v_nivel is null or v_nivel = 'C2' then null else jsonb_build_object(
      'nivel_superior', public.toefl_nivel_vecino(v_nivel, 1),
      'seguidos', case when v_ultimo->>'nivel_actual' = v_nivel::text and coalesce((v_ultimo->>'pct_superior')::numeric, 0) >= 80 then 1 else 0 end,
      'ultimo_pct', case when v_ultimo->>'nivel_actual' = v_nivel::text then (v_ultimo->>'pct_superior')::numeric end
    ) end,
    'plan', case when v_plan.student_id is null then null else jsonb_build_object(
      'exam_date', v_plan.exam_date,
      'dias', v_plan.dias,
      'toca_hoy', extract(isodow from v_hoy)::smallint = any (v_plan.dias),
      'hecha_hoy', exists (select 1 from public.exam_history where student_id = v_uid and exam_type = 'toefl_plan' and public.toefl_dia(completed_at) = v_hoy),
      'semana', coalesce((
        select jsonb_agg(public.toefl_dia(completed_at) order by completed_at)
        from public.exam_history
        where student_id = v_uid and exam_type = 'toefl_plan'
          and public.toefl_dia(completed_at) >= v_hoy - (extract(isodow from v_hoy)::int - 1)
      ), '[]'::jsonb)
    ) end,
    'racha', jsonb_build_object(
      'hecha_hoy', v_hoy = any (coalesce(v_dias_racha, '{}')),
      'dias_seguidos', v_seguidos
    ),
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

commit;
