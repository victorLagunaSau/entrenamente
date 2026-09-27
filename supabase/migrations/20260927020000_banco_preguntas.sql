-- Entrena Mente · Banco de preguntas (reactivos) y su importación masiva.
--
-- Se corre DESPUÉS de 20260927010000_catalogo_oficial.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué agrega:
--   · materias: catálogo (MAT, ESP…). El importador registra las nuevas.
--   · lecturas: textos largos guardados UNA vez (se deduplican por hash; varias preguntas comparten lectura).
--   · reactivos: una fila por pregunta. Respuestas y solución en jsonb dentro de la fila (se leen siempre juntas).
--     Llave interna bigint (pesará poco en la futura tabla de respuestas de alumnos) + `codigo` único
--     (UNAM-A1-MAT-007-V03). `hash` = huella del contenido para no reescribir lo que no cambió.
--   · reactivo_carreras: relación muchos a muchos con `carreras` (asignación manual del admin).
--   · lotes_importacion: bitácora de cada lote (sin guardar el JSON).
--   · importar_reactivos(): alta/actualización por bloques; cada llamada es una transacción corta.
--
-- Acceso: por ahora solo admin (el motor de exámenes para alumnos llegará con su propia lectura controlada).
-- Las materias son de lectura pública (catálogo).

begin;

-- ═════════════════════════ 1. Tablas ═════════════════════════

create table public.materias (
  clave text primary key check (clave ~ '^[A-Z]{2,4}$'),                 -- tercer bloque del ID de reactivo
  nombre text not null check (length(trim(nombre)) > 0),
  created_at timestamptz not null default now()
);

create table public.lecturas (
  id bigint generated always as identity primary key,
  hash text not null unique,                                             -- md5 del texto
  texto text not null check (length(trim(texto)) > 0),
  created_at timestamptz not null default now()
);

create table public.reactivos (
  id bigint generated always as identity primary key,
  codigo text not null unique check (codigo ~ '^[A-Z0-9]+-[A-Z0-9]+-[A-Z]{2,4}-[0-9]{3,4}-V[0-9]{2,3}$'),
  institucion_id text not null references public.instituciones(id),
  materia_clave text not null references public.materias(clave),
  dificultad text not null check (dificultad in ('facil', 'media', 'dificil')),
  valor_puntos numeric(5, 2) not null default 1 check (valor_puntos > 0),
  fuente text not null default '',
  fuente_detallada text not null default '',
  lectura_id bigint references public.lecturas(id),
  pregunta text not null check (length(trim(pregunta)) > 0),
  -- [{ id, texto, ponderacion, diagnosticoError }] — exactamente una con ponderacion 1 (lo valida el importador).
  respuestas jsonb not null check (jsonb_typeof(respuestas) = 'array' and jsonb_array_length(respuestas) >= 2),
  solucion jsonb not null default '[]' check (jsonb_typeof(solucion) = 'array'),
  variantes text[] not null default '{}',                                -- variantesAsociadas: solo dato, no se usa
  hash text not null,                                                    -- huella del contenido (la calcula el cliente)
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Búsqueda obligatoria del catálogo: institución + materia.
create index reactivos_busqueda_idx on public.reactivos (institucion_id, materia_clave, dificultad);

create table public.reactivo_carreras (
  reactivo_id bigint not null references public.reactivos(id) on delete cascade,
  carrera_id text not null references public.carreras(id),
  primary key (reactivo_id, carrera_id)
);
create index reactivo_carreras_carrera_idx on public.reactivo_carreras (carrera_id);

create table public.lotes_importacion (
  id bigint generated always as identity primary key,
  archivo text not null,
  hash_archivo text,
  institucion_id text references public.instituciones(id),
  carreras text[] not null default '{}',
  total integer not null default 0,
  nuevas integer not null default 0,
  actualizadas integer not null default 0,
  sin_cambios integer not null default 0,
  omitidas integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create trigger reactivos_touch before update on public.reactivos
  for each row execute function public.touch_updated_at();

-- ═════════════════════════ 2. Semilla ═════════════════════════

insert into public.materias (clave, nombre) values
  ('MAT', 'Matemáticas'),
  ('FIS', 'Física'),
  ('QUI', 'Química'),
  ('BIO', 'Biología'),
  ('ESP', 'Español'),
  ('LIT', 'Literatura'),
  ('HIM', 'Historia de México'),
  ('HIU', 'Historia Universal'),
  ('GEO', 'Geografía'),
  ('FIL', 'Filosofía'),
  ('ING', 'Inglés');

-- ═════════════════════════ 3. Importación ═════════════════════════

-- p_items: [{ codigo, institucion (clave), materia, materia_nombre, dificultad, valor_puntos, fuente,
--             fuente_detallada, lectura, pregunta, respuestas, solucion, variantes, hash }]
-- p_carreras: ids de carreras a asignar a todos los reactivos del bloque.
-- p_reemplazar_carreras: true en la edición manual (las no marcadas se quitan); en el importador se suman.
create or replace function public.importar_reactivos(
  p_items jsonb,
  p_carreras text[],
  p_reemplazar_carreras boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_inst text;
  v_lectura_id bigint;
  v_id bigint;
  v_hash text;
  v_sumadas integer;
  v_quitadas integer := 0;
  v_nuevas integer := 0;
  v_actualizadas integer := 0;
  v_sin_cambios integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede importar reactivos.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_carreras, 1), 0) = 0 then
    raise exception 'Asigna al menos una carrera.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select i.id into v_inst from public.instituciones i where i.clave = v_item->>'institucion';
    if v_inst is null then
      raise exception 'Institución % no existe (reactivo %).', v_item->>'institucion', v_item->>'codigo' using errcode = '23503';
    end if;
    if exists (select 1 from unnest(p_carreras) c
               where not exists (select 1 from public.carreras k where k.id = c and k.institucion_id = v_inst)) then
      raise exception 'Alguna carrera no pertenece a % (reactivo %).', v_item->>'institucion', v_item->>'codigo' using errcode = '23503';
    end if;

    insert into public.materias (clave, nombre)
    values (v_item->>'materia', coalesce(nullif(v_item->>'materia_nombre', ''), v_item->>'materia'))
    on conflict (clave) do nothing;

    v_lectura_id := null;
    if nullif(trim(coalesce(v_item->>'lectura', '')), '') is not null then
      insert into public.lecturas (hash, texto)
      values (md5(v_item->>'lectura'), v_item->>'lectura')
      on conflict (hash) do nothing;
      select l.id into v_lectura_id from public.lecturas l where l.hash = md5(v_item->>'lectura');
    end if;

    select r.id, r.hash into v_id, v_hash from public.reactivos r where r.codigo = v_item->>'codigo';

    if v_id is null then
      insert into public.reactivos (
        codigo, institucion_id, materia_clave, dificultad, valor_puntos, fuente, fuente_detallada,
        lectura_id, pregunta, respuestas, solucion, variantes, hash
      ) values (
        v_item->>'codigo', v_inst, v_item->>'materia', v_item->>'dificultad',
        coalesce((v_item->>'valor_puntos')::numeric, 1), coalesce(v_item->>'fuente', ''),
        coalesce(v_item->>'fuente_detallada', ''), v_lectura_id, v_item->>'pregunta',
        v_item->'respuestas', coalesce(v_item->'solucion', '[]'),
        coalesce(array(select jsonb_array_elements_text(v_item->'variantes')), '{}'), v_item->>'hash'
      )
      returning id into v_id;
      v_nuevas := v_nuevas + 1;
      insert into public.reactivo_carreras (reactivo_id, carrera_id)
      select v_id, c from unnest(p_carreras) c;
      continue;
    end if;

    -- Existente: se reescribe solo si cambió el contenido; las carreras se suman (o se reemplazan).
    if v_hash is distinct from v_item->>'hash' then
      update public.reactivos set
        institucion_id = v_inst,
        materia_clave = v_item->>'materia',
        dificultad = v_item->>'dificultad',
        valor_puntos = coalesce((v_item->>'valor_puntos')::numeric, 1),
        fuente = coalesce(v_item->>'fuente', ''),
        fuente_detallada = coalesce(v_item->>'fuente_detallada', ''),
        lectura_id = v_lectura_id,
        pregunta = v_item->>'pregunta',
        respuestas = v_item->'respuestas',
        solucion = coalesce(v_item->'solucion', '[]'),
        variantes = coalesce(array(select jsonb_array_elements_text(v_item->'variantes')), '{}'),
        hash = v_item->>'hash'
      where id = v_id;
    end if;

    if p_reemplazar_carreras then
      delete from public.reactivo_carreras where reactivo_id = v_id and carrera_id <> all (p_carreras);
      get diagnostics v_quitadas = row_count;
    end if;
    insert into public.reactivo_carreras (reactivo_id, carrera_id)
    select v_id, c from unnest(p_carreras) c
    on conflict do nothing;
    get diagnostics v_sumadas = row_count;

    if v_hash is distinct from v_item->>'hash' or v_sumadas > 0 or v_quitadas > 0 then
      v_actualizadas := v_actualizadas + 1;
    else
      v_sin_cambios := v_sin_cambios + 1;
    end if;
  end loop;

  return jsonb_build_object('nuevas', v_nuevas, 'actualizadas', v_actualizadas, 'sin_cambios', v_sin_cambios);
end;
$$;

-- ═════════════════════════ 4. Seguridad (RLS y permisos) ═════════════════════════

alter table public.materias enable row level security;
alter table public.lecturas enable row level security;
alter table public.reactivos enable row level security;
alter table public.reactivo_carreras enable row level security;
alter table public.lotes_importacion enable row level security;

create policy "materias: lectura" on public.materias for select to anon, authenticated using (true);
create policy "materias: admin agrega" on public.materias for insert to authenticated with check (public.is_admin());
create policy "materias: admin edita" on public.materias for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lecturas: admin" on public.lecturas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "reactivos: admin" on public.reactivos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "reactivo_carreras: admin" on public.reactivo_carreras for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lotes: admin ve" on public.lotes_importacion for select to authenticated using (public.is_admin());
create policy "lotes: admin registra" on public.lotes_importacion for insert to authenticated with check (public.is_admin());

-- Supabase da todos los privilegios por defecto; se dejan solo los necesarios (RLS limita al admin).
revoke all on public.materias, public.lecturas, public.reactivos, public.reactivo_carreras, public.lotes_importacion
  from anon, authenticated;
grant select on public.materias to anon, authenticated;
grant insert, update (nombre) on public.materias to authenticated;
grant select, insert, delete on public.lecturas to authenticated;
grant select, insert, update, delete on public.reactivos to authenticated;
grant select, insert, delete on public.reactivo_carreras to authenticated;
grant select, insert on public.lotes_importacion to authenticated;

revoke execute on function public.importar_reactivos(jsonb, text[], boolean) from public, anon;
grant execute on function public.importar_reactivos(jsonb, text[], boolean) to authenticated;

commit;
