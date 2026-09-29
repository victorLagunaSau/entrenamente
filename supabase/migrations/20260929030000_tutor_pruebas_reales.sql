-- Entrena Mente · Home Padre / Maestro: pruebas con grupo de enfoque, con datos reales.
--
-- Se corre DESPUÉS de 20260929020000_tutor_limite_y_reporte.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · plan_prueba_tutor(): TEMPORAL mientras no hay procesador de pagos. El padre/maestro cambia entre
--     "Modo demo" (sin licencia) y "Plan Familiar" (licencia real de prueba: 5 lugares, 30 días) y sus
--     estudiantes vinculados ocupan un lugar (acceso ilimitado real). Se apaga con:
--       update public.app_settings set plan_prueba_tutor = false;
--   · panel_tutor(): cada estudiante trae todas sus metas (carrera + universidad).
--   · agregar_meta_tutor(): el tutor con plan agrega otra carrera/escuela a su estudiante.
--   · planes_tutor() / crear_plan_tutor(): ver y programar el plan de estudio del estudiante
--     (mismo calendario y reglas que crear_plan del alumno).

begin;

-- ═════════════════════════ 1. Plan Familiar de prueba (sin pagos) ═════════════════════════

alter table public.app_settings add column plan_prueba_tutor boolean not null default true;

create or replace function public.plan_prueba_tutor(p_activar boolean)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_motivo constant text := 'Prueba con grupo de enfoque';
  v_license uuid;
begin
  if not coalesce((select plan_prueba_tutor from public.app_settings), false) then
    raise exception 'El plan de prueba ya no está disponible.' using errcode = '42501';
  end if;

  if not p_activar then
    -- Vuelve a demo: se borra solo la licencia de prueba (sus lugares se van con ella).
    delete from public.licenses where owner_id = v_uid and source = 'admin' and granted_reason = v_motivo;
    return;
  end if;

  select id into v_license from public.licenses
  where owner_id = v_uid and status = 'active' and expires_at > now()
  order by seats desc limit 1;

  if v_license is null then
    insert into public.licenses (owner_id, plan, seats, source, status, expires_at, granted_reason, authorized_by)
    values (v_uid, 'family_5', 5, 'admin', 'active', now() + interval '30 days', v_motivo, v_uid)
    returning id into v_license;
  end if;

  -- Sus estudiantes vinculados sin acceso vigente ocupan un lugar (hasta llenar la licencia).
  perform public.assign_seat(v_license, t.student_id)
  from public.tutor_students t
  where t.owner_id = v_uid
  order by t.linked_at;
end;
$$;

-- ═════════════════════════ 2. Panel con todas las metas ═════════════════════════

create or replace function public.panel_tutor()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_lic public.licenses := public.licencia_tutor(v_uid);
  v_vigente boolean := v_lic.id is not null and v_lic.status = 'active' and v_lic.expires_at > now();
begin
  return jsonb_build_object(
    'licencia', case when v_lic.id is null then null else jsonb_build_object(
      'id', v_lic.id,
      'plan', v_lic.plan,
      'cupos', v_lic.seats,
      'usados', (select count(*) from public.license_seats s where s.license_id = v_lic.id and s.released_at is null),
      'origen', v_lic.source,
      'vigente', v_vigente,
      'inicia', v_lic.starts_at,
      'vence', v_lic.expires_at,
      'renovacion_automatica', v_lic.source = 'stripe' and v_lic.stripe_subscription_id is not null
    ) end,
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'nombre', g.name) order by lower(g.name))
      from public.tutor_groups g where g.owner_id = v_uid
    ), '[]'::jsonb),
    'estudiantes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'alias', p.alias,
        'nombre', p.full_name,
        'grupo_id', t.group_id,
        'vinculado', t.linked_at,
        'registrado', p.created_at,
        'universidad_id', g.university_id,
        'carrera_id', g.career_id,
        'carrera', c.nombre,
        'universidad', i.clave,
        'metas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'carrera_id', sg.career_id,
            'universidad_id', sg.university_id,
            'carrera', c2.nombre,
            'universidad', i2.clave,
            'inicial', sg.is_initial
          ) order by sg.is_initial desc, sg.created_at)
          from public.student_goals sg
          left join public.carreras c2 on c2.id = sg.career_id
          left join public.instituciones i2 on i2.id = c2.institucion_id
          where sg.user_id = p.id
        ), '[]'::jsonb),
        'activo', a.tutor,
        'acceso', case
          when a.tutor then 'tutor'
          when a.otra then 'otra'
          when sp.free_trial_ends_at > now() and sp.free_exams_used < sp.free_exams_granted then 'prueba'
          else 'inactivo'
        end,
        'prueba', case when sp.user_id is null then null else jsonb_build_object(
          'termina', sp.free_trial_ends_at,
          'otorgadas', sp.free_exams_granted,
          'usadas', sp.free_exams_used
        ) end
      ) order by lower(p.alias))
      from public.tutor_students t
      join public.profiles p on p.id = t.student_id
      left join public.student_profiles sp on sp.user_id = p.id
      left join lateral (
        select sg.university_id, sg.career_id from public.student_goals sg
        where sg.user_id = p.id order by sg.is_initial desc, sg.created_at limit 1
      ) g on true
      left join public.carreras c on c.id = g.career_id
      left join public.instituciones i on i.id = c.institucion_id
      cross join lateral (
        select
          coalesce(bool_or(l.owner_id = v_uid), false) as tutor,
          coalesce(bool_or(l.owner_id <> v_uid), false) as otra
        from public.license_seats s join public.licenses l on l.id = s.license_id
        where s.student_id = p.id and s.released_at is null and l.status = 'active' and l.expires_at > now()
      ) a
      where t.owner_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- ═════════════════════════ 3. Metas y planes del estudiante ═════════════════════════

-- Tutor con plan vigente y estudiante vinculado (lo que piden las acciones de pago del panel).
create or replace function public.exigir_tutor_con_plan(p_estudiante uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_lic public.licenses := public.licencia_tutor(v_uid);
begin
  perform public.exigir_estudiante_del_tutor(v_uid, p_estudiante);
  if v_lic.id is null or v_lic.status <> 'active' or v_lic.expires_at <= now() then
    raise exception 'Activa tu plan para usar esta función.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create or replace function public.agregar_meta_tutor(p_estudiante uuid, p_carrera text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_inst text;
begin
  perform public.exigir_tutor_con_plan(p_estudiante);
  select c.institucion_id into v_inst
  from public.carreras c join public.instituciones i on i.id = c.institucion_id
  where c.id = p_carrera and c.activo and i.activo;
  if v_inst is null then
    raise exception 'La carrera no está disponible.' using errcode = '23503';
  end if;
  if exists (select 1 from public.student_goals where user_id = p_estudiante and career_id = p_carrera) then
    raise exception 'Esa carrera ya es una de sus metas.' using errcode = '23505';
  end if;
  insert into public.student_goals (user_id, university_id, career_id, is_initial)
  values (p_estudiante, v_inst, p_carrera, false);
end;
$$;

-- Planes activos con su calendario y la calificación de cada examen (misma forma que lee el alumno).
create or replace function public.planes_tutor(p_estudiante uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.exigir_estudiante_del_tutor(public.exigir_tutor(), p_estudiante);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'career_id', p.career_id,
      'university_key', p.university_key,
      'career_name', p.career_name,
      'official_exam_date', p.official_exam_date,
      'practice_days', p.practice_days,
      'exams_per_day', p.exams_per_day,
      'difficulty_mode', p.difficulty_mode,
      'fixed_difficulty_level', p.fixed_difficulty_level,
      'preferred_time_window', p.preferred_time_window,
      'created_at', p.created_at,
      'plan_sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id,
          'scheduled_date', s.scheduled_date,
          'kind', s.kind,
          'status', s.status,
          'exam', case when e.id is null then null else jsonb_build_object(
            'id', e.id, 'folio', e.folio, 'level', e.level, 'score_achieved', e.score_achieved,
            'max_score', e.max_score, 'completed_at', e.completed_at
          ) end
        ) order by s.scheduled_date, s.id)
        from public.plan_sessions s
        left join public.exam_history e on e.id = s.exam_history_id
        where s.plan_id = p.id
      ), '[]'::jsonb)
    ) order by p.created_at)
    from public.student_plans p
    where p.student_id = p_estudiante and p.status = 'active'
  ), '[]'::jsonb);
end;
$$;

-- Mismas reglas que crear_plan() del alumno, a nombre del estudiante vinculado.
create or replace function public.crear_plan_tutor(
  p_estudiante uuid,
  p_carrera text,
  p_fecha_examen date,
  p_dias text[],
  p_por_dia integer,
  p_modo text,
  p_nivel text,
  p_horario text
)
returns bigint
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_hoy date := public.hoy_mx();
  v_semana text[] := array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  v_carrera record;
  v_plan bigint;
  v_sesiones integer;
begin
  perform public.exigir_tutor_con_plan(p_estudiante);
  if not exists (select 1 from public.student_goals g where g.user_id = p_estudiante and g.career_id = p_carrera) then
    raise exception 'Esa carrera no está en sus metas.' using errcode = '42501';
  end if;

  select c.id, c.nombre, i.clave
  into v_carrera
  from public.carreras c join public.instituciones i on i.id = c.institucion_id
  where c.id = p_carrera and c.activo and i.activo;
  if v_carrera.id is null then
    raise exception 'La carrera no está disponible.' using errcode = '23503';
  end if;

  if p_fecha_examen is null or p_fecha_examen <= v_hoy then
    raise exception 'La fecha del examen debe ser posterior a hoy.' using errcode = '22023';
  end if;
  if p_fecha_examen > v_hoy + 540 then
    raise exception 'El plan puede cubrir hasta 18 meses.' using errcode = '22023';
  end if;
  if p_dias is null or cardinality(p_dias) = 0 or not (p_dias <@ v_semana) then
    raise exception 'Elige al menos un día de práctica.' using errcode = '22023';
  end if;
  if p_por_dia is null or p_por_dia not between 1 and 3 then
    raise exception 'Puedes programar de 1 a 3 exámenes por día.' using errcode = '22023';
  end if;
  if p_modo not in ('automatic', 'fixed') or (p_modo = 'fixed' and p_nivel not in ('facil', 'media', 'dificil')) then
    raise exception 'Tipo de dificultad inválido.' using errcode = '22023';
  end if;

  update public.student_plans
  set status = 'completed'
  where student_id = p_estudiante and career_id = p_carrera and status = 'active' and official_exam_date <= v_hoy;

  if exists (select 1 from public.student_plans where student_id = p_estudiante and career_id = p_carrera and status = 'active') then
    raise exception 'Ya tiene un plan activo para esta carrera.' using errcode = '23505';
  end if;

  insert into public.student_plans (
    student_id, career_id, university_key, career_name, official_exam_date, practice_days, exams_per_day,
    difficulty_mode, fixed_difficulty_level, preferred_time_window
  ) values (
    p_estudiante, v_carrera.id, v_carrera.clave, v_carrera.nombre, p_fecha_examen,
    array(select d from unnest(v_semana) with ordinality w(d, n) where d = any (p_dias) order by n),
    p_por_dia, p_modo, case when p_modo = 'fixed' then p_nivel end, p_horario
  )
  returning id into v_plan;

  insert into public.plan_sessions (plan_id, student_id, scheduled_date)
  select v_plan, p_estudiante, d::date
  from generate_series(v_hoy, p_fecha_examen - 1, interval '1 day') d
  cross join generate_series(1, p_por_dia) slot
  where v_semana[extract(isodow from d)::int] = any (p_dias)
  order by d, slot;

  get diagnostics v_sesiones = row_count;
  if v_sesiones = 0 then
    raise exception 'No queda ningún día de práctica antes de su examen. Elige más días.' using errcode = '22023';
  end if;

  return v_plan;
end;
$$;

-- ═════════════════════════ 4. Permisos ═════════════════════════

revoke execute on function public.exigir_tutor_con_plan(uuid) from public, anon, authenticated;
revoke execute on function public.plan_prueba_tutor(boolean) from public, anon;
revoke execute on function public.agregar_meta_tutor(uuid, text) from public, anon;
revoke execute on function public.planes_tutor(uuid) from public, anon;
revoke execute on function public.crear_plan_tutor(uuid, text, date, text[], integer, text, text, text) from public, anon;
grant execute on function public.plan_prueba_tutor(boolean) to authenticated;
grant execute on function public.agregar_meta_tutor(uuid, text) to authenticated;
grant execute on function public.planes_tutor(uuid) to authenticated;
grant execute on function public.crear_plan_tutor(uuid, text, date, text[], integer, text, text, text) to authenticated;

commit;
