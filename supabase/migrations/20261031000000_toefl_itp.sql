-- Módulo TOEFL ITP · fase 1: modelo de datos + importación por ZIP (manifest.json + audios/*.mp3).
--
-- TOEFL es una herramienta propia, fuera del catálogo de escuelas y del banco de reactivos de admisión.
--   · toefl_context_assets: audios y pasajes de lectura que varias preguntas comparten.
--   · toefl_questions: preguntas con opciones ponderadas y diagnóstico / solución en español e inglés.
--   · toefl_import_batches: bitácora de paquetes importados.
--   · Bucket público `toefl-audios`: el panel sube los MP3 antes de llamar a importar_toefl().
--   · profiles.target_toefl_age_range (lo elige el alumno) y profiles.current_mcer_level
--     (null hasta el diagnóstico; solo lo cambian las funciones del examen, fase 2).
--
-- Las tablas solo las lee el admin: el alumno nunca recibe ponderaciones; los exámenes llegarán por RPC.
-- importar_toefl() es una sola transacción: si algo falla no queda ni un asset ni una pregunta.

begin;

-- ═════════════════════════ 1. Tipos y perfil ═════════════════════════

create type public.toefl_age_range as enum ('8_11_primary', '11_15_junior', '16_mas');
create type public.mcer_level as enum ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

alter table public.profiles
  add column target_toefl_age_range public.toefl_age_range not null default '16_mas',
  add column current_mcer_level public.mcer_level;

grant update (target_toefl_age_range) on public.profiles to authenticated;

-- ═════════════════════════ 2. Tablas ═════════════════════════

create table public.toefl_context_assets (
  id uuid primary key default gen_random_uuid(),
  -- Llave del paquete: el audioKey, el passageKey o PAS-<md5 del pasaje>. Reimportar actualiza el mismo registro.
  context_key varchar(100) not null unique,
  audio_key varchar(100) unique,                                          -- null si es solo pasaje de lectura
  audio_path text,                                                        -- ruta dentro del bucket toefl-audios
  audio_url text,
  audio_max_plays integer not null default 1 check (audio_max_plays between 1 and 5),
  reading_passage text,
  transcription_audio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (audio_key is not null or nullif(trim(coalesce(reading_passage, '')), '') is not null),
  check ((audio_key is null) = (audio_url is null))
);

create table public.toefl_questions (
  id varchar(100) primary key
    check (id ~ '^TOEFL-[A-Z]{3,5}-(A1|A2|B1|B2|C1|C2)-[0-9]{3,5}-V[0-9]{2,3}$'),   -- TOEFL-LIST-B2-1001-V01
  seed_code varchar(100) not null,
  age_range public.toefl_age_range not null,
  mcer_level public.mcer_level not null,
  section varchar(30) not null check (section in ('listening', 'structure', 'reading')),
  context_asset_id uuid references public.toefl_context_assets(id) on delete set null,
  question_text text not null check (length(trim(question_text)) > 0),
  -- [{ id, texto, ponderacion, diagnosticoError_es, diagnosticoError_en }] — exactamente una con ponderacion 1.
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  step_by_step_explanation_es jsonb not null default '[]'::jsonb check (jsonb_typeof(step_by_step_explanation_es) = 'array'),
  step_by_step_explanation_en jsonb not null default '[]'::jsonb check (jsonb_typeof(step_by_step_explanation_en) = 'array'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- El generador de exámenes filtra por edad + nivel + sección.
create index toefl_questions_pool_idx on public.toefl_questions (age_range, mcer_level, section) where is_active;
create index toefl_questions_seed_idx on public.toefl_questions (seed_code);
create index toefl_questions_context_idx on public.toefl_questions (context_asset_id);

create table public.toefl_import_batches (
  id bigint generated always as identity primary key,
  archivo text not null,
  total integer not null default 0,
  nuevas integer not null default 0,
  actualizadas integer not null default 0,
  audios integer not null default 0,
  pasajes integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create trigger toefl_context_assets_touch before update on public.toefl_context_assets
  for each row execute function public.touch_updated_at();
create trigger toefl_questions_touch before update on public.toefl_questions
  for each row execute function public.touch_updated_at();

-- ═════════════════════════ 3. Acceso ═════════════════════════

alter table public.toefl_context_assets enable row level security;
alter table public.toefl_questions enable row level security;
alter table public.toefl_import_batches enable row level security;

revoke all on public.toefl_context_assets, public.toefl_questions, public.toefl_import_batches from anon, authenticated;
grant select on public.toefl_context_assets, public.toefl_questions, public.toefl_import_batches to authenticated;
-- Activar / desactivar una pregunta desde el panel.
grant update (is_active) on public.toefl_questions to authenticated;

create policy "toefl assets: admin lee" on public.toefl_context_assets
  for select to authenticated using (public.is_admin());
create policy "toefl preguntas: admin lee" on public.toefl_questions
  for select to authenticated using (public.is_admin());
create policy "toefl preguntas: admin activa" on public.toefl_questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "toefl lotes: admin lee" on public.toefl_import_batches
  for select to authenticated using (public.is_admin());

-- Audios: lectura pública por URL (el reproductor limita las reproducciones); solo el admin sube o borra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('toefl-audios', 'toefl-audios', true, 20971520, array['audio/mpeg', 'audio/mp3'])
on conflict (id) do nothing;

create policy "toefl-audios: admin sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'toefl-audios' and public.is_admin());
create policy "toefl-audios: admin cambia" on storage.objects
  for update to authenticated using (bucket_id = 'toefl-audios' and public.is_admin())
  with check (bucket_id = 'toefl-audios' and public.is_admin());
create policy "toefl-audios: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'toefl-audios' and public.is_admin());

-- ═════════════════════════ 4. Importación ═════════════════════════

-- p_assets: [{ context_key, audio_key, audio_path, audio_url, audio_max_plays, reading_passage, transcription_audio }]
-- p_items:  [{ id, seed_code, age_range, mcer_level, section, context_key, question_text, options,
--              step_by_step_explanation_es, step_by_step_explanation_en }]
-- Todo o nada: cualquier error deshace el paquete completo (el panel borra los audios que alcanzó a subir).
create or replace function public.importar_toefl(p_archivo text, p_assets jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset jsonb;
  v_item jsonb;
  v_ctx uuid;
  v_correctas integer;
  v_nuevas integer := 0;
  v_actualizadas integer := 0;
  v_audios integer := 0;
  v_pasajes integer := 0;
  v_ids text[];
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede importar preguntas TOEFL.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El manifest no trae preguntas.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 2000 then
    raise exception 'Máximo 2000 preguntas por paquete.' using errcode = '22023';
  end if;

  select array_agg(e->>'id') into v_ids from jsonb_array_elements(p_items) e;
  if (select count(distinct x) from unnest(v_ids) x) <> array_length(v_ids, 1) then
    raise exception 'El manifest repite IDs de pregunta.' using errcode = '23505';
  end if;

  -- Assets compartidos: uno por llave, se actualizan si ya existían.
  for v_asset in select * from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb)) loop
    insert into public.toefl_context_assets as a (
      context_key, audio_key, audio_path, audio_url, audio_max_plays, reading_passage, transcription_audio
    ) values (
      v_asset->>'context_key',
      nullif(v_asset->>'audio_key', ''),
      nullif(v_asset->>'audio_path', ''),
      nullif(v_asset->>'audio_url', ''),
      coalesce((v_asset->>'audio_max_plays')::integer, 1),
      nullif(trim(coalesce(v_asset->>'reading_passage', '')), ''),
      nullif(trim(coalesce(v_asset->>'transcription_audio', '')), '')
    )
    on conflict (context_key) do update set
      audio_key = excluded.audio_key,
      audio_path = excluded.audio_path,
      audio_url = excluded.audio_url,
      audio_max_plays = excluded.audio_max_plays,
      reading_passage = excluded.reading_passage,
      transcription_audio = excluded.transcription_audio;
    if nullif(v_asset->>'audio_key', '') is not null then v_audios := v_audios + 1; else v_pasajes := v_pasajes + 1; end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_ctx := null;
    if nullif(v_item->>'context_key', '') is not null then
      select a.id into v_ctx from public.toefl_context_assets a where a.context_key = v_item->>'context_key';
      if v_ctx is null then
        raise exception 'La pregunta % apunta a un contexto que no viene en el paquete (%).', v_item->>'id', v_item->>'context_key'
          using errcode = '23503';
      end if;
    end if;

    if v_item->>'section' = 'listening'
       and not exists (select 1 from public.toefl_context_assets a where a.id = v_ctx and a.audio_key is not null) then
      raise exception 'La pregunta % es de listening y no tiene audio.', v_item->>'id' using errcode = '23514';
    end if;

    select count(*) into v_correctas from jsonb_array_elements(v_item->'options') o
    where (o->>'ponderacion')::numeric = 1;
    if v_correctas <> 1 then
      raise exception 'La pregunta % debe tener exactamente una opción con ponderación 1.', v_item->>'id' using errcode = '23514';
    end if;

    if exists (select 1 from public.toefl_questions q where q.id = v_item->>'id') then
      v_actualizadas := v_actualizadas + 1;
    else
      v_nuevas := v_nuevas + 1;
    end if;

    insert into public.toefl_questions as q (
      id, seed_code, age_range, mcer_level, section, context_asset_id, question_text, options,
      step_by_step_explanation_es, step_by_step_explanation_en
    ) values (
      v_item->>'id',
      v_item->>'seed_code',
      (v_item->>'age_range')::public.toefl_age_range,
      (v_item->>'mcer_level')::public.mcer_level,
      v_item->>'section',
      v_ctx,
      v_item->>'question_text',
      v_item->'options',
      coalesce(v_item->'step_by_step_explanation_es', '[]'::jsonb),
      coalesce(v_item->'step_by_step_explanation_en', '[]'::jsonb)
    )
    on conflict (id) do update set
      seed_code = excluded.seed_code,
      age_range = excluded.age_range,
      mcer_level = excluded.mcer_level,
      section = excluded.section,
      context_asset_id = excluded.context_asset_id,
      question_text = excluded.question_text,
      options = excluded.options,
      step_by_step_explanation_es = excluded.step_by_step_explanation_es,
      step_by_step_explanation_en = excluded.step_by_step_explanation_en;
  end loop;

  insert into public.toefl_import_batches (archivo, total, nuevas, actualizadas, audios, pasajes)
  values (coalesce(nullif(p_archivo, ''), 'paquete.zip'), jsonb_array_length(p_items), v_nuevas, v_actualizadas, v_audios, v_pasajes);

  return jsonb_build_object(
    'total', jsonb_array_length(p_items), 'nuevas', v_nuevas, 'actualizadas', v_actualizadas,
    'audios', v_audios, 'pasajes', v_pasajes
  );
end;
$$;

revoke execute on function public.importar_toefl(text, jsonb, jsonb) from public, anon;
grant execute on function public.importar_toefl(text, jsonb, jsonb) to authenticated;

-- Inventario del panel: preguntas activas por edad × nivel × sección.
create or replace function public.inventario_toefl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede ver el inventario TOEFL.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.toefl_questions where is_active),
    'inactivas', (select count(*) from public.toefl_questions where not is_active),
    'audios', (select count(*) from public.toefl_context_assets where audio_key is not null),
    'pasajes', (select count(*) from public.toefl_context_assets where audio_key is null),
    'celdas', coalesce((
      select jsonb_agg(jsonb_build_object('age_range', age_range, 'mcer_level', mcer_level, 'section', section, 'total', n)
                       order by age_range, mcer_level, section)
      from (
        select age_range, mcer_level, section, count(*) as n
        from public.toefl_questions where is_active
        group by age_range, mcer_level, section
      ) c
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.inventario_toefl() from public, anon;
grant execute on function public.inventario_toefl() to authenticated;

commit;
