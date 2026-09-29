-- Entrena Mente · Home Demo: campaña configurable por el admin y candados de la prueba gratuita.
--
-- Se corre DESPUÉS de 20260928040000_acceso_examenes.sql.
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · demo_campaign_config: textos del Home Demo (título de campaña, bienvenida, subtítulo, frase de cierre),
--     precio mostrado y el interruptor de la campaña. Se lee con get_demo_campaign() y el admin la cambia con
--     guardar_demo_campaign() (también fija app_settings.free_exams_on_signup: solo afecta a registros NUEVOS).
--   · exam_history.prueba_gratis: marca los exámenes que gastaron una prueba gratis (métricas y guía del Demo).
--   · Candados del Demo (sin licencia): solo Examen Libre, solo de la carrera elegida al registrarse y solo con
--     la campaña activa. Modo Racha y Plan quedan para el acceso ilimitado.

begin;

-- ═════════════════════════ 1. Configuración de la campaña (una sola fila) ═════════════════════════

create table public.demo_campaign_config (
  id boolean primary key default true check (id),
  activa boolean not null default true,
  titulo_campana text not null default 'Diagnóstico gratuito'
    check (char_length(titulo_campana) between 1 and 60),
  -- Marcadores: {alias}, {carrera}, {universidad}, {n} (número de exámenes gratis del alumno).
  titulo_bienvenida text not null default '¡Bienvenido, {alias}! Diagnostica tu nivel para {carrera}'
    check (char_length(titulo_bienvenida) between 1 and 160),
  subtitulo text not null default 'Completa tus {n} evaluaciones gratuitas de entrenamiento y descubre tus brechas de conocimiento antes del examen real.'
    check (char_length(subtitulo) between 1 and 300),
  frase_cierre text not null default '¿Quieres practicar con más de 1,000 reactivos mutantes, diagnósticos por IA y carreras ilimitadas?'
    check (char_length(frase_cierre) between 1 and 200),
  precio_mensual_mxn numeric(8, 2) not null default 40 check (precio_mensual_mxn >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.demo_campaign_config default values;
alter table public.demo_campaign_config enable row level security;
revoke all on public.demo_campaign_config from anon, authenticated;       -- solo por las funciones de abajo

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
    updated_at = now(),
    updated_by = (select auth.uid());

  update public.app_settings set free_exams_on_signup = p_pruebas_al_registrarse, updated_at = now();

  return public.get_demo_campaign();
end;
$$;

revoke execute on function public.get_demo_campaign() from public, anon;
revoke execute on function public.guardar_demo_campaign(boolean, text, text, text, text, numeric, integer) from public, anon;
grant execute on function public.get_demo_campaign() to authenticated;
grant execute on function public.guardar_demo_campaign(boolean, text, text, text, text, numeric, integer) to authenticated;

-- ═════════════════════════ 2. Exámenes que gastaron una prueba gratis ═════════════════════════

alter table public.exam_history add column prueba_gratis boolean not null default false;

-- Historial previo: se marcan los exámenes libres de quienes hoy no tienen licencia (el historial es inmutable,
-- así que se suspende su candado solo durante este update).
alter table public.exam_history disable trigger exam_history_no_update;
update public.exam_history h set prueba_gratis = true
where h.exam_type = 'libre'
  and not exists (select 1 from public.profiles p where p.id = h.student_id and p.user_type = 'admin')
  and not exists (
    select 1 from public.license_seats s join public.licenses l on l.id = s.license_id
    where s.student_id = h.student_id and s.released_at is null and l.status = 'active' and l.expires_at > now()
  );
alter table public.exam_history enable trigger exam_history_no_update;

-- Al guardar sin licencia: solo Examen Libre, descuenta una prueba y marca el registro.
create or replace function public.consumir_prueba_gratis()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select status from public.get_my_access()) = 'active' then
    return new;
  end if;
  if new.exam_type <> 'libre' then
    raise exception 'El Modo Racha y el Plan personalizado son parte del acceso ilimitado.' using errcode = 'P0402';
  end if;
  update public.student_profiles
  set free_exams_used = free_exams_used + 1
  where user_id = new.student_id and free_exams_used < free_exams_granted;
  if not found then
    raise exception 'Ya usaste tus pruebas gratis. Desbloquea el acceso ilimitado para seguir entrenando.'
      using errcode = 'P0402';
  end if;
  new.prueba_gratis := true;
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

-- ═════════════════════════ 4. Generadores: mismas funciones, con el candado nuevo ═════════════════════════

create or replace function public.generar_examen_libre(p_carrera text, p_nivel text, p_total integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_relleno text;
  v_pesos jsonb;
  v_out jsonb;
begin
  perform public.exigir_acceso_examen('libre', p_carrera); -- 1.º: licencia, o prueba gratis de su carrera
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
  select d.por_materia into v_pesos from public.carrera_dosificacion d where d.carrera_id = p_carrera;

  with base as (
    select distinct on (regexp_replace(r.codigo, '-V[0-9]+$', ''))
      r.id, r.codigo, r.materia_clave, r.dificultad, r.valor_puntos, r.lectura_id, r.pregunta, r.respuestas
    from public.reactivos r
    join public.reactivo_carreras rc on rc.reactivo_id = r.id and rc.carrera_id = p_carrera
    order by regexp_replace(r.codigo, '-V[0-9]+$', ''), random()
  ),
  -- Peso de cada materia: el de la dosificación o, sin ella, el mismo para todas.
  pesos as (
    select m.materia_clave,
      case when v_pesos is null then 1 else coalesce((v_pesos->>m.materia_clave)::numeric, 0) end as peso
    from (select distinct materia_clave from base) m
  ),
  -- Lugar de cada pregunta dentro de su nivel y materia.
  por_nivel as (
    select b.*, random() as rnd,
      row_number() over (partition by b.materia_clave, b.dificultad order by random()) as k
    from base b
  ),
  -- Intercala dominante (cada 1/0.7) y relleno (cada 1/0.3); lo demás va al final.
  en_materia as (
    select x.*,
      row_number() over (
        partition by x.materia_clave
        order by case
          when x.dificultad = p_nivel then (x.k - 0.5) / 0.7
          when x.dificultad = v_relleno then (x.k - 0.5) / 0.3
          else 1e6 + x.rnd
        end
      ) as n
    from por_nivel x
  ),
  elegidos as (
    select e.*
    from en_materia e
    join pesos p using (materia_clave)
    order by
      case when p.peso > 0 then (e.n - 0.5) / p.peso else 1e9 + e.n end,
      e.rnd
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
  perform public.exigir_acceso_examen('racha', p_carrera); -- 1.º: solo con licencia
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
  perform public.exigir_acceso_examen('plan', null); -- 1.º: solo con licencia
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

-- El candado anterior (sin tipo ni carrera) ya no lo usa nadie.
drop function if exists public.exigir_acceso_examen();

commit;
