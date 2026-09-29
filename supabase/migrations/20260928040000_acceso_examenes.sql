-- Entrena Mente · Los exámenes revisan la licencia y cuentan las pruebas gratis.
--
-- Se corre DESPUÉS de 20260928030000_conteo_variantes.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · app_settings.free_exams_on_signup: cuántas pruebas gratis recibe quien se registra DESDE HOY. Cambiarlo no
--     afecta a los ya registrados:  update public.app_settings set free_exams_on_signup = 20;
--   · student_profiles.free_exams_granted: las pruebas gratis de cada alumno, fijadas al registrarse
--     (los ya registrados conservan 3, el límite que tenían).
--   · get_my_access(): "free" = usadas < otorgadas del propio alumno (antes: límite global fijo de 3).
--   · generar_examen_libre / racha / plan: su primer paso es exigir_acceso_examen(); sin licencia ni pruebas → error.
--   · exam_history: al guardar un examen sin licencia se descuenta una prueba (trigger). Se descuenta al TERMINAR,
--     no al empezar: un examen abandonado no gasta prueba. Cubre libre, racha y plan en un solo lugar.

begin;

-- ═════════════════════════ 1. Pruebas gratis por alumno ═════════════════════════

create table public.app_settings (
  id boolean primary key default true check (id),                         -- una sola fila
  free_exams_on_signup integer not null default 3 check (free_exams_on_signup >= 0),
  updated_at timestamptz not null default now()
);
insert into public.app_settings default values;
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;              -- solo por SQL (y a futuro, el admin)

create or replace function public.free_exams_on_signup()
returns integer
language sql stable security definer set search_path = ''
as $$ select coalesce((select free_exams_on_signup from public.app_settings), 3) $$;
revoke execute on function public.free_exams_on_signup() from public, anon, authenticated;

-- Los ya registrados quedan con 3; los nuevos toman el valor vigente al crear su perfil (lo hace handle_new_user).
alter table public.student_profiles add column free_exams_granted integer not null default 3 check (free_exams_granted >= 0);
alter table public.student_profiles alter column free_exams_granted set default public.free_exams_on_signup();

-- ═════════════════════════ 2. Interruptor con las pruebas del propio alumno ═════════════════════════

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
    select greatest(free_exams_granted - free_exams_used, 0) as left_
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

-- El límite global ya no se usa: cada alumno trae el suyo.
drop function if exists public.free_exam_limit();

-- ═════════════════════════ 3. Candado de los exámenes ═════════════════════════

-- Primer paso de generar_examen_*: con licencia (o admin) o con pruebas gratis disponibles se continúa.
create or replace function public.exigir_acceso_examen()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para presentar un examen.' using errcode = '42501';
  end if;
  if coalesce((select status from public.get_my_access()), 'inactive') = 'inactive' then
    raise exception 'Ya usaste tus pruebas gratis. Desbloquea el acceso ilimitado para seguir entrenando.'
      using errcode = 'P0402';
  end if;
end;
$$;
revoke execute on function public.exigir_acceso_examen() from public, anon, authenticated;

-- Al guardar (congelar_examen inserta aquí): sin licencia descuenta una prueba; sin pruebas, no se guarda.
-- El update condicionado evita que dos exámenes simultáneos gasten la misma última prueba.
create or replace function public.consumir_prueba_gratis()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select status from public.get_my_access()) = 'active' then
    return new;
  end if;
  update public.student_profiles
  set free_exams_used = free_exams_used + 1
  where user_id = new.student_id and free_exams_used < free_exams_granted;
  if not found then
    raise exception 'Ya usaste tus pruebas gratis. Desbloquea el acceso ilimitado para seguir entrenando.'
      using errcode = 'P0402';
  end if;
  return new;
end;
$$;
revoke execute on function public.consumir_prueba_gratis() from public, anon, authenticated;

create trigger exam_history_consumir_prueba before insert on public.exam_history
  for each row execute function public.consumir_prueba_gratis();

-- ═════════════════════════ 4. Generadores: mismas funciones, con el candado al inicio ═════════════════════════

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
  perform public.exigir_acceso_examen(); -- 1.º: licencia vigente o pruebas gratis disponibles
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
  perform public.exigir_acceso_examen(); -- 1.º: licencia vigente o pruebas gratis disponibles
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
  perform public.exigir_acceso_examen(); -- 1.º: licencia vigente o pruebas gratis disponibles
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

commit;
