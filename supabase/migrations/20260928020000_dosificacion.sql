-- Entrena Mente · Dosificación del examen por carrera (% por materia).
--
-- Se corre DESPUÉS de 20260928010000_examen_plan.sql.
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué agrega:
--   · carrera_dosificacion: qué porcentaje del examen real corresponde a cada materia, por carrera.
--     Viene del bloque guia.dosificacion de cada lote; la última guía importada reemplaza a la anterior.
--   · guardar_dosificacion(): la guarda para las carreras elegidas en el paso 1 de Carga masiva (solo admin).
--   · generar_examen_libre() (también la usa Examen Plan): reparte las preguntas según la dosificación.
--     Sin dosificación, reparte en partes iguales entre las materias con preguntas.

begin;

-- ═════════════════════════ 1. Tabla ═════════════════════════

create table public.carrera_dosificacion (
  carrera_id text primary key references public.carreras(id) on delete cascade,
  -- { "MAT": 20.0, "FIS": 15.0, … } por clave de materia; suma 100.0.
  por_materia jsonb not null check (jsonb_typeof(por_materia) = 'object'),
  metodo text not null check (metodo in ('oficial', 'estimado')),
  fuente text,
  total_reactivos_oficial integer check (total_reactivos_oficial > 0),
  archivo text,
  actualizado timestamptz not null default now(),
  actualizado_por uuid default auth.uid()
);

alter table public.carrera_dosificacion enable row level security;
create policy "carrera_dosificacion: admin lee" on public.carrera_dosificacion for select to authenticated using (public.is_admin());
revoke all on public.carrera_dosificacion from anon, authenticated;
grant select on public.carrera_dosificacion to authenticated;

-- ═════════════════════════ 2. Guardar (Carga masiva) ═════════════════════════

-- p_dosificacion: { por_materia: { clave: pct }, metodo, fuente, total_reactivos_oficial, archivo }
create or replace function public.guardar_dosificacion(p_carreras text[], p_dosificacion jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_por jsonb := p_dosificacion->'por_materia';
  v_suma numeric;
  v_mala text;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede guardar la dosificación.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_carreras), 0) = 0 then
    raise exception 'Elige al menos una carrera.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_por) is distinct from 'object' or v_por = '{}' then
    raise exception 'La dosificación no trae materias.' using errcode = '22023';
  end if;

  select k into v_mala from jsonb_each(v_por) e(k, v)
  where jsonb_typeof(v) <> 'number' or v::numeric < 0 or v::numeric > 100
  limit 1;
  if v_mala is not null then
    raise exception 'Porcentaje inválido en %.', v_mala using errcode = '22023';
  end if;

  select k into v_mala from jsonb_object_keys(v_por) k
  where not exists (select 1 from public.materias m where m.clave = k)
  limit 1;
  if v_mala is not null then
    raise exception 'La materia % no existe en el catálogo.', v_mala using errcode = '23503';
  end if;

  select sum(v::numeric) into v_suma from jsonb_each_text(v_por) e(k, v);
  if round(v_suma, 1) <> 100.0 then
    raise exception 'La dosificación suma % y debe sumar 100.0.', round(v_suma, 1) using errcode = '22023';
  end if;

  insert into public.carrera_dosificacion as d (carrera_id, por_materia, metodo, fuente, total_reactivos_oficial, archivo)
  select c, v_por,
    coalesce(nullif(p_dosificacion->>'metodo', ''), 'estimado'),
    nullif(p_dosificacion->>'fuente', ''),
    (p_dosificacion->>'total_reactivos_oficial')::integer,
    nullif(p_dosificacion->>'archivo', '')
  from unnest(p_carreras) c
  on conflict (carrera_id) do update set
    por_materia = excluded.por_materia,
    metodo = excluded.metodo,
    fuente = excluded.fuente,
    total_reactivos_oficial = excluded.total_reactivos_oficial,
    archivo = excluded.archivo,
    actualizado = now(),
    actualizado_por = auth.uid();
end;
$$;

revoke all on function public.guardar_dosificacion(text[], jsonb) from public, anon;
grant execute on function public.guardar_dosificacion(text[], jsonb) to authenticated;

-- ═════════════════════════ 3. Generación con dosificación ═════════════════════════

-- Reparto por materia con el método de Webster: cada pregunta candidata recibe la clave (n − 0.5) / peso,
-- donde n es su lugar dentro de su materia, y se toman las p_total claves menores. Da cupos proporcionales
-- a la dosificación (redondeo justo) y, si una materia se queda sin preguntas, las demás completan solas.
-- Materias sin porcentaje (o con 0 %) solo entran si ya no alcanza con las dosificadas.
-- Dentro de cada materia se intercalan nivel dominante ~70 % y relleno ~30 % (fácil→media, media→fácil,
-- difícil→media); luego lo que haya. Una sola variante por raíz. Salida agrupada por materia.
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

commit;
