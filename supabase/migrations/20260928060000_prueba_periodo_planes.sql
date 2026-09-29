-- Entrena Mente · Home Demo (2.ª parte): periodo de prueba, planes mensual/anual e identidad de la prueba gratuita.
--
-- Se corre DESPUÉS de 20260928050000_home_demo.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · demo_campaign_config: precio del Plan Estudiante mensual ($80, base para descuentos) y anual ($950), días de
--     prueba (15) y frase de cierre sin "diagnósticos por IA" (no disponible por ahora).
--   · student_profiles.free_trial_ends_at: fin del periodo de prueba de cada alumno, fijado al registrarse
--     (los ya registrados reciben el periodo completo desde hoy). Vencido, get_my_access() ya no da "free".
--   · student_profiles.first_activity_at: su primera actividad (el primer examen que guarda).
--   · exam_history.prueba_numero: la prueba gratuita es un Examen Libre (mismo motor y reporte) con identidad
--     propia: "Prueba gratuita 1 de 4".
--   · guardar_demo_campaign() recibe también el precio anual y los días de prueba (solo afectan registros NUEVOS).

begin;

-- ═════════════════════════ 1. Campaña: planes y periodo de prueba ═════════════════════════

alter table public.demo_campaign_config
  alter column frase_cierre set default '¿Quieres practicar con más de 1,000 reactivos mutantes y carreras ilimitadas?',
  alter column precio_mensual_mxn set default 80,
  add column precio_anual_mxn numeric(8, 2) not null default 950 check (precio_anual_mxn >= 0),
  add column dias_prueba integer not null default 15 check (dias_prueba between 1 and 365);

-- Solo se reemplaza lo que sigue con el valor de fábrica (si el admin ya lo cambió, se respeta).
update public.demo_campaign_config set
  frase_cierre = case
    when frase_cierre = '¿Quieres practicar con más de 1,000 reactivos mutantes, diagnósticos por IA y carreras ilimitadas?'
    then '¿Quieres practicar con más de 1,000 reactivos mutantes y carreras ilimitadas?' else frase_cierre end,
  precio_mensual_mxn = case when precio_mensual_mxn = 40 then 80 else precio_mensual_mxn end,
  updated_at = now();

-- Periodo de prueba por alumno, fijado al registrarse (los ya registrados reciben el periodo completo desde hoy).
create or replace function public.free_trial_ends_on_signup()
returns timestamptz
language sql volatile security definer set search_path = ''
as $$ select now() + make_interval(days => coalesce((select dias_prueba from public.demo_campaign_config), 15)) $$;
revoke execute on function public.free_trial_ends_on_signup() from public, anon, authenticated;

alter table public.student_profiles
  add column free_trial_ends_at timestamptz not null default public.free_trial_ends_on_signup(),
  add column first_activity_at timestamptz;

update public.student_profiles sp set first_activity_at = h.primera
from (select student_id, min(completed_at) as primera from public.exam_history group by student_id) h
where h.student_id = sp.user_id;

-- Interruptor: "free" exige pruebas disponibles Y periodo vigente.
create or replace function public.get_my_access()
returns table (
  status text,
  source text,
  plan text,
  expires_at timestamptz,
  sponsor_alias text,
  free_exams_left integer
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select p.id, p.user_type from public.profiles p where p.id = (select auth.uid())
  ),
  lic as (
    select l.source, l.plan, l.expires_at,
           case when l.owner_id <> s.student_id then o.alias end as sponsor_alias
    from public.license_seats s
    join public.licenses l on l.id = s.license_id
    join public.profiles o on o.id = l.owner_id
    where s.student_id = (select auth.uid()) and s.released_at is null
      and l.status = 'active' and l.expires_at > now()
    limit 1
  ),
  sp as (
    select case when free_trial_ends_at > now() then greatest(free_exams_granted - free_exams_used, 0) else 0 end as left_
    from public.student_profiles where user_id = (select auth.uid())
  )
  select
    case
      when me.user_type = 'admin' then 'active'
      when lic.source is not null then 'active'
      when coalesce(sp.left_, 0) > 0 then 'free'
      else 'inactive'
    end,
    case when me.user_type = 'admin' then 'admin' else lic.source end,
    lic.plan,
    lic.expires_at,
    lic.sponsor_alias,
    coalesce(sp.left_, 0)
  from me
  left join lic on true
  left join sp on true;
$$;

-- Lo que pinta el Home Demo: la campaña + las pruebas del propio alumno (el admin ve el valor de registro).
create or replace function public.get_demo_campaign()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'activa', c.activa,
    'titulo_campana', c.titulo_campana,
    'titulo_bienvenida', c.titulo_bienvenida,
    'subtitulo', c.subtitulo,
    'frase_cierre', c.frase_cierre,
    'precio_mensual_mxn', c.precio_mensual_mxn,
    'precio_anual_mxn', c.precio_anual_mxn,
    'dias_prueba', c.dias_prueba,
    'prueba_termina', sp.free_trial_ends_at,
    'pruebas_al_registrarse', public.free_exams_on_signup(),
    'pruebas_otorgadas', coalesce(sp.free_exams_granted, public.free_exams_on_signup()),
    'pruebas_usadas', coalesce(sp.free_exams_used, 0),
    'updated_at', c.updated_at
  )
  from public.demo_campaign_config c
  left join public.student_profiles sp on sp.user_id = (select auth.uid())
  where (select auth.uid()) is not null;
$$;

-- Solo admin. Las pruebas gratis nuevas se fijan al registrarse: cambiarlas no toca a los ya registrados.
create or replace function public.guardar_demo_campaign(
  p_activa boolean,
  p_titulo_campana text,
  p_titulo_bienvenida text,
  p_subtitulo text,
  p_frase_cierre text,
  p_precio_mensual_mxn numeric,
  p_precio_anual_mxn numeric,
  p_dias_prueba integer,
  p_pruebas_al_registrarse integer
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar la campaña.' using errcode = '42501';
  end if;
  if p_pruebas_al_registrarse is null or p_pruebas_al_registrarse < 0 or p_pruebas_al_registrarse > 20 then
    raise exception 'Las pruebas gratis van de 0 a 20.' using errcode = '22023';
  end if;

  update public.demo_campaign_config set
    activa = coalesce(p_activa, true),
    titulo_campana = btrim(p_titulo_campana),
    titulo_bienvenida = btrim(p_titulo_bienvenida),
    subtitulo = btrim(p_subtitulo),
    frase_cierre = btrim(p_frase_cierre),
    precio_mensual_mxn = p_precio_mensual_mxn,
    precio_anual_mxn = p_precio_anual_mxn,
    dias_prueba = p_dias_prueba,
    updated_at = now(),
    updated_by = (select auth.uid());

  update public.app_settings set free_exams_on_signup = p_pruebas_al_registrarse, updated_at = now();

  return public.get_demo_campaign();
end;
$$;

drop function if exists public.guardar_demo_campaign(boolean, text, text, text, text, numeric, integer);
revoke execute on function public.get_demo_campaign() from public, anon;
revoke execute on function public.guardar_demo_campaign(boolean, text, text, text, text, numeric, numeric, integer, integer) from public, anon;
grant execute on function public.get_demo_campaign() to authenticated;
grant execute on function public.guardar_demo_campaign(boolean, text, text, text, text, numeric, numeric, integer, integer) to authenticated;

-- ═════════════════════════ 2. Identidad de la prueba gratuita ═════════════════════════

alter table public.exam_history add column prueba_numero smallint check (prueba_numero > 0);

-- Numera las pruebas ya guardadas de cada alumno (el historial es inmutable: su candado se suspende solo aquí).
alter table public.exam_history disable trigger exam_history_no_update;
update public.exam_history h set prueba_numero = x.n
from (
  select e.id, row_number() over (partition by e.student_id order by e.completed_at, e.id) as n
  from public.exam_history e
  where e.prueba_gratis
) x
where x.id = h.id;
alter table public.exam_history enable trigger exam_history_no_update;

alter table public.exam_history
  add constraint exam_history_prueba_numerada check (prueba_gratis = (prueba_numero is not null));

-- Al guardar: registra la primera actividad. Sin licencia: solo Examen Libre, descuenta una prueba y la numera.
-- Un examen empezado dentro del periodo se puede entregar aunque el periodo venza mientras se responde.
create or replace function public.consumir_prueba_gratis()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_numero integer;
begin
  update public.student_profiles set first_activity_at = now()
  where user_id = new.student_id and first_activity_at is null;

  if (select status from public.get_my_access()) = 'active' then
    return new;
  end if;
  if new.exam_type <> 'libre' then
    raise exception 'El Modo Racha y el Plan personalizado son parte del acceso ilimitado.' using errcode = 'P0402';
  end if;
  update public.student_profiles
  set free_exams_used = free_exams_used + 1
  where user_id = new.student_id and free_exams_used < free_exams_granted
  returning free_exams_used into v_numero;
  if not found then
    raise exception 'Ya usaste tus pruebas gratis. Desbloquea el acceso ilimitado para seguir entrenando.'
      using errcode = 'P0402';
  end if;
  new.prueba_gratis := true;
  new.prueba_numero := v_numero;
  return new;
end;
$$;

-- ═════════════════════════ 3. Candado por tipo de examen y carrera ═════════════════════════

-- Primer paso de generar_examen_*. Con licencia (o admin): todo. Con pruebas gratis: solo Examen Libre de la
-- carrera elegida al registrarse y con la campaña activa. Sin nada: bloqueado.
create or replace function public.exigir_acceso_examen(p_tipo text, p_carrera text)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para presentar un examen.' using errcode = '42501';
  end if;
  v_status := coalesce((select status from public.get_my_access()), 'inactive');
  if v_status = 'active' then
    return;
  end if;
  if v_status = 'inactive' then
    if exists (
      select 1 from public.student_profiles
      where user_id = (select auth.uid()) and free_trial_ends_at <= now() and free_exams_used < free_exams_granted
    ) then
      raise exception 'Tu periodo de prueba terminó. Desbloquea el acceso ilimitado para seguir entrenando.' using errcode = 'P0402';
    end if;
    raise exception 'Ya usaste tus pruebas gratis. Desbloquea el acceso ilimitado para seguir entrenando.'
      using errcode = 'P0402';
  end if;
  if not coalesce((select activa from public.demo_campaign_config), false) then
    raise exception 'La prueba gratuita no está disponible por ahora. Desbloquea el acceso ilimitado para entrenar.'
      using errcode = 'P0402';
  end if;
  if p_tipo <> 'libre' then
    raise exception 'El Modo Racha y el Plan personalizado son parte del acceso ilimitado.' using errcode = 'P0402';
  end if;
  if not exists (
    select 1 from public.student_goals g
    where g.user_id = (select auth.uid()) and g.is_initial and g.career_id = p_carrera
  ) then
    raise exception 'Tus exámenes gratis son para la carrera que elegiste al registrarte.' using errcode = 'P0402';
  end if;
end;
$$;
revoke execute on function public.exigir_acceso_examen(text, text) from public, anon, authenticated;

commit;
