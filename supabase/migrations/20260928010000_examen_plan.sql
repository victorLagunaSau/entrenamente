-- Entrena Mente · Examen Plan (plan personalizado por carrera con fecha límite).
--
-- Se corre DESPUÉS de 20260928000000_examen_racha.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Mismo examen, calificación e historial que el Examen Libre (exam_history, exam_type = 'plan'); lo nuevo es la agenda.
--
-- Qué agrega:
--   · student_plans: la configuración del plan (carrera, fecha del examen oficial, días, exámenes por día, dificultad, horario).
--     Un plan activo por carrera.
--   · plan_sessions: el calendario ya calculado, un renglón por examen programado. Al presentarlo queda ligado a su
--     registro de exam_history. Los de "refuerzo" los agrega el sistema cuando un examen sale bajo.
--   · crear_plan(): valida y calcula el calendario (de hoy al día anterior al examen oficial, en los días elegidos).
--   · nivel_plan(): dificultad del siguiente examen. Fija, o automática con el último examen del plan:
--     ≥ 85 % sube un nivel, < 65 % baja uno, en medio se queda (mismos umbrales que src/features/plan/lib/plan.ts).
--     El primero es de nivel medio.
--   · generar_examen_plan() / guardar_examen_plan(): arman y califican el examen de una sesión pendiente de hoy o atrasada.
--     Si sale < 65 %, se agrega un examen de refuerzo al siguiente día de práctica (una vez, hasta que lo presente).
--   · mover_sesion_plan(): reagendar un examen pendiente (de hoy al día anterior al examen oficial).
--   · cancelar_plan(): da de baja el plan; su historial se conserva.
--   · opciones_examen_libre(): ahora cuenta cada variante como pregunta (total general, igual que el banco del admin).
--
-- Las tablas son de solo lectura para el alumno: toda escritura pasa por estas funciones.
-- "Hoy" es la fecha de la Ciudad de México.

begin;

-- ═════════════════════════ 1. Tablas ═════════════════════════

create table public.student_plans (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  career_id text not null references public.carreras(id),
  university_key text not null,                                          -- copiados: el plan se lee sin el catálogo
  career_name text not null,
  official_exam_date date not null,
  practice_days text[] not null check (
    cardinality(practice_days) between 1 and 7
    and practice_days <@ array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  ),
  exams_per_day smallint not null default 1 check (exams_per_day between 1 and 3),
  difficulty_mode text not null check (difficulty_mode in ('automatic', 'fixed')),
  fixed_difficulty_level text check (fixed_difficulty_level in ('facil', 'media', 'dificil')),
  preferred_time_window text not null check (preferred_time_window ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  check ((difficulty_mode = 'fixed') = (fixed_difficulty_level is not null))
);

create unique index student_plans_una_activa on public.student_plans (student_id, career_id) where status = 'active';
create index student_plans_student_idx on public.student_plans (student_id, created_at desc);

create table public.plan_sessions (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.student_plans(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,   -- repetido para RLS sin join
  scheduled_date date not null,
  kind text not null default 'regular' check (kind in ('regular', 'refuerzo')),
  status text not null default 'pendiente' check (status in ('pendiente', 'completado')),
  exam_history_id bigint unique references public.exam_history(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'completado') = (completed_at is not null))
);

create index plan_sessions_plan_idx on public.plan_sessions (plan_id, scheduled_date, id);

alter table public.student_plans enable row level security;
alter table public.plan_sessions enable row level security;

create policy "student_plans: dueño o admin ve" on public.student_plans
  for select to authenticated using (student_id = (select auth.uid()) or public.is_admin());
create policy "plan_sessions: dueño o admin ve" on public.plan_sessions
  for select to authenticated using (student_id = (select auth.uid()) or public.is_admin());

revoke all on public.student_plans, public.plan_sessions from anon, authenticated;
grant select on public.student_plans, public.plan_sessions to authenticated;

-- ═════════════════════════ 2. Utilidades ═════════════════════════

create or replace function public.hoy_mx()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Mexico_City')::date;
$$;

-- Sesión del alumno con su plan, bloqueada para escribir. Error si no es suya o el plan no está activo.
create or replace function public.sesion_plan_propia(p_sesion bigint)
returns table (sesion_id bigint, plan_id bigint, career_id text, scheduled_date date, status text, official_exam_date date)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
    select s.id, p.id, p.career_id, s.scheduled_date, s.status, p.official_exam_date
    from public.plan_sessions s
    join public.student_plans p on p.id = s.plan_id
    where s.id = p_sesion and s.student_id = (select auth.uid()) and p.status = 'active'
    for update of s;
  if not found then
    raise exception 'Este examen no está en tu plan activo.' using errcode = '42501';
  end if;
end;
$$;

-- ═════════════════════════ 3. Crear y cancelar ═════════════════════════

create or replace function public.crear_plan(
  p_carrera text,
  p_fecha_examen date,
  p_dias text[],
  p_por_dia integer,
  p_modo text,
  p_nivel text,
  p_horario text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hoy date := public.hoy_mx();
  v_semana text[] := array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  v_carrera record;
  v_plan bigint;
  v_sesiones integer;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para crear tu plan.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.student_goals g where g.user_id = v_uid and g.career_id = p_carrera) then
    raise exception 'Esa carrera no está en tu perfil.' using errcode = '42501';
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

  -- Un plan vencido (su examen oficial ya pasó) deja lugar a uno nuevo.
  update public.student_plans
  set status = 'completed'
  where student_id = v_uid and career_id = p_carrera and status = 'active' and official_exam_date <= v_hoy;

  if exists (select 1 from public.student_plans where student_id = v_uid and career_id = p_carrera and status = 'active') then
    raise exception 'Ya tienes un plan activo para esta carrera.' using errcode = '23505';
  end if;

  insert into public.student_plans (
    student_id, career_id, university_key, career_name, official_exam_date, practice_days, exams_per_day,
    difficulty_mode, fixed_difficulty_level, preferred_time_window
  ) values (
    v_uid, v_carrera.id, v_carrera.clave, v_carrera.nombre, p_fecha_examen,
    array(select d from unnest(v_semana) with ordinality w(d, n) where d = any (p_dias) order by n),
    p_por_dia, p_modo, case when p_modo = 'fixed' then p_nivel end, p_horario
  )
  returning id into v_plan;

  -- Calendario: de hoy al día anterior al examen oficial, en los días elegidos (isodow 1 = lunes).
  insert into public.plan_sessions (plan_id, student_id, scheduled_date)
  select v_plan, v_uid, d::date
  from generate_series(v_hoy, p_fecha_examen - 1, interval '1 day') d
  cross join generate_series(1, p_por_dia) slot
  where v_semana[extract(isodow from d)::int] = any (p_dias)
  order by d, slot;

  get diagnostics v_sesiones = row_count;
  if v_sesiones = 0 then
    raise exception 'No queda ningún día de práctica antes de tu examen. Elige más días.' using errcode = '22023';
  end if;

  return v_plan;
end;
$$;

create or replace function public.cancelar_plan(p_plan bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.student_plans
  set status = 'cancelled'
  where id = p_plan and student_id = (select auth.uid()) and status = 'active';
  if not found then
    raise exception 'Este plan ya no está activo.' using errcode = '42501';
  end if;
end;
$$;

-- ═════════════════════════ 4. Dificultad ═════════════════════════

create or replace function public.nivel_plan(p_plan bigint)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan record;
  v_ultimo record;
  v_pct numeric;
begin
  select p.difficulty_mode, p.fixed_difficulty_level
  into v_plan
  from public.student_plans p
  where p.id = p_plan and (p.student_id = (select auth.uid()) or public.is_admin());
  if not found then
    raise exception 'Plan no encontrado.' using errcode = '42501';
  end if;
  if v_plan.difficulty_mode = 'fixed' then
    return v_plan.fixed_difficulty_level;
  end if;

  select h.level, h.score_achieved, h.max_score
  into v_ultimo
  from public.plan_sessions s
  join public.exam_history h on h.id = s.exam_history_id
  where s.plan_id = p_plan
  order by h.completed_at desc, h.id desc
  limit 1;
  if not found then
    return 'media';
  end if;

  v_pct := case when v_ultimo.max_score > 0 then v_ultimo.score_achieved / v_ultimo.max_score else 0 end;
  return case
    when v_pct >= 0.85 then case v_ultimo.level when 'facil' then 'media' else 'dificil' end
    when v_pct < 0.65 then case v_ultimo.level when 'dificil' then 'media' else 'facil' end
    else v_ultimo.level
  end;
end;
$$;

-- ═════════════════════════ 5. Generar y guardar ═════════════════════════

-- Devuelve { nivel, preguntas: [...] } (mismo formato que generar_examen_libre: sin ponderaciones).
create or replace function public.generar_examen_plan(p_sesion bigint, p_total integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s record;
  v_nivel text;
begin
  select * into v_s from public.sesion_plan_propia(p_sesion);
  if v_s.status <> 'pendiente' then
    raise exception 'Ya presentaste este examen.' using errcode = '22023';
  end if;
  if v_s.scheduled_date > public.hoy_mx() then
    raise exception 'Este examen está programado para otro día. Muévelo a hoy en tu calendario para presentarlo.' using errcode = '22023';
  end if;

  v_nivel := public.nivel_plan(v_s.plan_id);
  return jsonb_build_object('nivel', v_nivel, 'preguntas', public.generar_examen_libre(v_s.career_id, v_nivel, p_total));
end;
$$;

create or replace function public.guardar_examen_plan(
  p_sesion bigint,
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
  v_s record;
  v_hoy date := public.hoy_mx();
  v_id bigint;
  v_pct numeric;
  v_refuerzo date;
begin
  select * into v_s from public.sesion_plan_propia(p_sesion);
  if v_s.status <> 'pendiente' then
    raise exception 'Ya presentaste este examen.' using errcode = '22023';
  end if;
  if v_s.scheduled_date > v_hoy then
    raise exception 'Este examen está programado para otro día.' using errcode = '22023';
  end if;
  -- La dificultad no la elige el alumno: debe ser la que le tocaba.
  if p_nivel is distinct from public.nivel_plan(v_s.plan_id) then
    raise exception 'La dificultad de tu plan cambió mientras presentabas. Vuelve a empezar.' using errcode = '22023';
  end if;

  v_id := public.congelar_examen('plan', v_s.career_id, p_nivel, p_respuestas, p_tiempo_limite, p_tiempo_usado, p_agotado, p_aviso_aceptado);

  update public.plan_sessions
  set status = 'completado', exam_history_id = v_id, completed_at = now()
  where id = p_sesion;

  -- Refuerzo: examen bajo (< 65 %) → uno extra en el siguiente día de práctica, si no hay otro pendiente.
  select case when h.max_score > 0 then h.score_achieved / h.max_score else 0 end
  into v_pct
  from public.exam_history h where h.id = v_id;

  if v_pct < 0.65 and not exists (
    select 1 from public.plan_sessions where plan_id = v_s.plan_id and kind = 'refuerzo' and status = 'pendiente'
  ) then
    select coalesce(
      (select min(scheduled_date) from public.plan_sessions
       where plan_id = v_s.plan_id and status = 'pendiente' and scheduled_date > v_hoy),
      case when v_hoy + 1 < v_s.official_exam_date then v_hoy + 1 end
    )
    into v_refuerzo;

    if v_refuerzo is not null then
      insert into public.plan_sessions (plan_id, student_id, scheduled_date, kind)
      values (v_s.plan_id, (select auth.uid()), v_refuerzo, 'refuerzo');
    end if;
  end if;

  return v_id;
end;
$$;

-- ═════════════════════════ 6. Reagendar ═════════════════════════

create or replace function public.mover_sesion_plan(p_sesion bigint, p_fecha date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s record;
begin
  select * into v_s from public.sesion_plan_propia(p_sesion);
  if v_s.status <> 'pendiente' then
    raise exception 'Un examen ya presentado no se puede mover.' using errcode = '22023';
  end if;
  if p_fecha is null or p_fecha < public.hoy_mx() or p_fecha >= v_s.official_exam_date then
    raise exception 'Elige un día entre hoy y el día anterior a tu examen oficial.' using errcode = '22023';
  end if;

  update public.plan_sessions set scheduled_date = p_fecha where id = p_sesion;
end;
$$;

-- ═════════════════════════ 7. Conteo de preguntas disponibles ═════════════════════════

-- Cada variante es una pregunta: el total por carrera y dificultad cuenta todos los reactivos (igual que el banco
-- del admin). Antes contaba una por raíz. Misma firma y salida: el Examen Libre no cambia.
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

-- ═════════════════════════ 8. Permisos ═════════════════════════

revoke execute on function public.hoy_mx() from public, anon;
revoke execute on function public.sesion_plan_propia(bigint) from public, anon, authenticated;
revoke execute on function public.crear_plan(text, date, text[], integer, text, text, text) from public, anon;
revoke execute on function public.cancelar_plan(bigint) from public, anon;
revoke execute on function public.nivel_plan(bigint) from public, anon;
revoke execute on function public.generar_examen_plan(bigint, integer) from public, anon;
revoke execute on function public.guardar_examen_plan(bigint, text, jsonb, integer, integer, boolean, boolean) from public, anon;
revoke execute on function public.mover_sesion_plan(bigint, date) from public, anon;

grant execute on function public.hoy_mx() to authenticated;
grant execute on function public.crear_plan(text, date, text[], integer, text, text, text) to authenticated;
grant execute on function public.cancelar_plan(bigint) to authenticated;
grant execute on function public.nivel_plan(bigint) to authenticated;
grant execute on function public.generar_examen_plan(bigint, integer) to authenticated;
grant execute on function public.guardar_examen_plan(bigint, text, jsonb, integer, integer, boolean, boolean) to authenticated;
grant execute on function public.mover_sesion_plan(bigint, date) to authenticated;

commit;
