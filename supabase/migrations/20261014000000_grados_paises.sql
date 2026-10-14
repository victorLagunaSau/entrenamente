-- Entrena Mente · Grados escolares universales, países y nombres de cada grado por país.
--
-- Pegar completo en Supabase → SQL Editor → Run. Va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · paises: catálogo de países (código ISO de 2 letras: MX, GT, US…). Lectura pública, edita el admin.
--   · grados: códigos universales del grado escolar.
--       g00            Preescolar / Kínder
--       g01 … g06      Primaria
--       g07 … g09      Secundaria / Básico
--       g10 … g12      Bachillerato / Preparatoria / Diversificado / High School (por año)
--       s01 … s06      Semestres de bachillerato (s01-s02 = 10, s03-s04 = 11, s05-s06 = 12)
--       pu             Preuniversitario: ya terminó el bachillerato y va directo al examen de admisión
--     `grado_numero` (0–12) es lo que usan las reglas (nivel de TOEFL, PISA, etc.).
--   · grados_pais: cómo se llama cada grado en cada país. Si un país no tiene fila para un código,
--     ese grado no se ofrece ahí (p. ej. los semestres solo existen en México).
--   · profiles.pais: país del usuario (null por ahora; se llena en otro módulo).
--   · student_profiles.grado: pasa de los valores viejos (bachillerato_1…) a estos códigos, con FK.
--       Por omisión 'pu' (grado 12): en esta etapa todos los estudiantes son de examen de admisión.
--   · student_profiles.flujo: 'admision' (hoy todos) o 'escolar' (TOEFL, PISA… más adelante).
--   · grados_para(p_pais): lista de grados con su nombre para un país (o el del usuario, o MX).

begin;

-- ═════════════════════════ 1. Países ═════════════════════════

create table public.paises (
  codigo char(2) primary key check (codigo ~ '^[A-Z]{2}$'),   -- ISO 3166-1 alfa-2
  nombre text not null check (length(trim(nombre)) > 0),      -- en español: "Estados Unidos"
  nombre_local text,                                          -- en su idioma: "United States"
  bandera text,                                               -- emoji: 🇲🇽
  lada text check (lada is null or lada ~ '^\+[0-9]{1,4}$'),  -- +52
  idioma text check (idioma is null or idioma ~ '^[a-z]{2}(-[A-Z]{2})?$'), -- es-MX, en-US
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.paises (codigo, nombre, nombre_local, bandera, lada, idioma, orden) values
  ('MX', 'México',          'México',        '🇲🇽', '+52',  'es-MX', 10),
  ('GT', 'Guatemala',       'Guatemala',     '🇬🇹', '+502', 'es-GT', 20),
  ('US', 'Estados Unidos',  'United States', '🇺🇸', '+1',   'en-US', 30);

-- ═════════════════════════ 2. Grados universales ═════════════════════════

create table public.grados (
  codigo text primary key check (codigo ~ '^(g(0[0-9]|1[0-2])|s0[1-6]|pu)$'),
  tipo text not null check (tipo in ('grado', 'semestre', 'preuniversitario')),
  grado_numero smallint not null check (grado_numero between 0 and 12),
  semestre smallint check (semestre between 1 and 6),
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((tipo = 'semestre') = (semestre is not null))
);

insert into public.grados (codigo, tipo, grado_numero, semestre, orden) values
  ('g00', 'grado', 0, null, 0),
  ('g01', 'grado', 1, null, 10), ('g02', 'grado', 2, null, 20), ('g03', 'grado', 3, null, 30),
  ('g04', 'grado', 4, null, 40), ('g05', 'grado', 5, null, 50), ('g06', 'grado', 6, null, 60),
  ('g07', 'grado', 7, null, 70), ('g08', 'grado', 8, null, 80), ('g09', 'grado', 9, null, 90),
  ('g10', 'grado', 10, null, 100), ('s01', 'semestre', 10, 1, 101), ('s02', 'semestre', 10, 2, 102),
  ('g11', 'grado', 11, null, 110), ('s03', 'semestre', 11, 3, 111), ('s04', 'semestre', 11, 4, 112),
  ('g12', 'grado', 12, null, 120), ('s05', 'semestre', 12, 5, 121), ('s06', 'semestre', 12, 6, 122),
  ('pu', 'preuniversitario', 12, null, 130);

-- ═════════════════════════ 3. Nombre de cada grado por país ═════════════════════════

create table public.grados_pais (
  pais char(2) not null references public.paises(codigo),
  grado text not null references public.grados(codigo),
  nivel text not null check (length(trim(nivel)) > 0),    -- para agrupar en listas: "Primaria", "High School"
  nombre text not null check (length(trim(nombre)) > 0),  -- "3.º de Bachillerato / Preparatoria"
  nombre_corto text,                                      -- "3.º Bach."
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pais, grado)
);

insert into public.grados_pais (pais, grado, nivel, nombre, nombre_corto) values
  -- México: bachillerato por año o por semestre.
  ('MX', 'g00', 'Preescolar',       'Preescolar (Kínder)',                  'Kínder'),
  ('MX', 'g01', 'Primaria',         '1.º de Primaria',                      '1.º Prim.'),
  ('MX', 'g02', 'Primaria',         '2.º de Primaria',                      '2.º Prim.'),
  ('MX', 'g03', 'Primaria',         '3.º de Primaria',                      '3.º Prim.'),
  ('MX', 'g04', 'Primaria',         '4.º de Primaria',                      '4.º Prim.'),
  ('MX', 'g05', 'Primaria',         '5.º de Primaria',                      '5.º Prim.'),
  ('MX', 'g06', 'Primaria',         '6.º de Primaria',                      '6.º Prim.'),
  ('MX', 'g07', 'Secundaria',       '1.º de Secundaria',                    '1.º Sec.'),
  ('MX', 'g08', 'Secundaria',       '2.º de Secundaria',                    '2.º Sec.'),
  ('MX', 'g09', 'Secundaria',       '3.º de Secundaria',                    '3.º Sec.'),
  ('MX', 'g10', 'Bachillerato',     '1.º de Bachillerato / Preparatoria',   '1.º Bach.'),
  ('MX', 's01', 'Bachillerato',     '1.er semestre de Bachillerato',        '1.er sem.'),
  ('MX', 's02', 'Bachillerato',     '2.º semestre de Bachillerato',         '2.º sem.'),
  ('MX', 'g11', 'Bachillerato',     '2.º de Bachillerato / Preparatoria',   '2.º Bach.'),
  ('MX', 's03', 'Bachillerato',     '3.er semestre de Bachillerato',        '3.er sem.'),
  ('MX', 's04', 'Bachillerato',     '4.º semestre de Bachillerato',         '4.º sem.'),
  ('MX', 'g12', 'Bachillerato',     '3.º de Bachillerato / Preparatoria',   '3.º Bach.'),
  ('MX', 's05', 'Bachillerato',     '5.º semestre de Bachillerato',         '5.º sem.'),
  ('MX', 's06', 'Bachillerato',     '6.º semestre de Bachillerato',         '6.º sem.'),
  ('MX', 'pu',  'Preuniversitario', 'Preuniversitario (ya terminé el bachillerato)', 'Preuniv.'),

  -- Guatemala: sin semestres; diversificado por año.
  ('GT', 'g00', 'Preprimaria',         'Preprimaria (Párvulos)',            'Párvulos'),
  ('GT', 'g01', 'Primaria',            '1.º Primaria',                      '1.º Prim.'),
  ('GT', 'g02', 'Primaria',            '2.º Primaria',                      '2.º Prim.'),
  ('GT', 'g03', 'Primaria',            '3.º Primaria',                      '3.º Prim.'),
  ('GT', 'g04', 'Primaria',            '4.º Primaria',                      '4.º Prim.'),
  ('GT', 'g05', 'Primaria',            '5.º Primaria',                      '5.º Prim.'),
  ('GT', 'g06', 'Primaria',            '6.º Primaria',                      '6.º Prim.'),
  ('GT', 'g07', 'Ciclo Básico',        '1.º Básico',                        '1.º Bás.'),
  ('GT', 'g08', 'Ciclo Básico',        '2.º Básico',                        '2.º Bás.'),
  ('GT', 'g09', 'Ciclo Básico',        '3.º Básico',                        '3.º Bás.'),
  ('GT', 'g10', 'Ciclo Diversificado', '1.º de Diversificado',              '1.º Div.'),
  ('GT', 'g11', 'Ciclo Diversificado', '2.º de Diversificado',              '2.º Div.'),
  ('GT', 'g12', 'Ciclo Diversificado', '3.º de Diversificado',              '3.º Div.'),
  ('GT', 'pu',  'Preuniversitario',    'Preuniversitario (ya me gradué)',    'Preuniv.'),

  -- Estados Unidos: en inglés, sin semestres.
  ('US', 'g00', 'Kindergarten',       'Kindergarten',                      'K'),
  ('US', 'g01', 'Elementary School',  '1st Grade',                         '1st'),
  ('US', 'g02', 'Elementary School',  '2nd Grade',                         '2nd'),
  ('US', 'g03', 'Elementary School',  '3rd Grade',                         '3rd'),
  ('US', 'g04', 'Elementary School',  '4th Grade',                         '4th'),
  ('US', 'g05', 'Elementary School',  '5th Grade',                         '5th'),
  ('US', 'g06', 'Middle School',      '6th Grade',                         '6th'),
  ('US', 'g07', 'Middle School',      '7th Grade',                         '7th'),
  ('US', 'g08', 'Middle School',      '8th Grade',                         '8th'),
  ('US', 'g09', 'High School',        '9th Grade (Freshman)',              '9th'),
  ('US', 'g10', 'High School',        '10th Grade (Sophomore)',            '10th'),
  ('US', 'g11', 'High School',        '11th Grade (Junior)',               '11th'),
  ('US', 'g12', 'High School',        '12th Grade (Senior)',               '12th'),
  ('US', 'pu',  'Pre-college',        'High School Graduate (pre-college)', 'Grad.');

create trigger paises_touch before update on public.paises
  for each row execute function public.touch_updated_at();
create trigger grados_touch before update on public.grados
  for each row execute function public.touch_updated_at();
create trigger grados_pais_touch before update on public.grados_pais
  for each row execute function public.touch_updated_at();

-- ═════════════════════════ 4. Seguridad ═════════════════════════

alter table public.paises enable row level security;
alter table public.grados enable row level security;
alter table public.grados_pais enable row level security;

create policy "paises: activos" on public.paises for select to anon, authenticated using (activo);
create policy "grados: activos" on public.grados for select to anon, authenticated using (activo);
create policy "grados_pais: activos" on public.grados_pais for select to anon, authenticated using (activo);

-- Admin: ve todo, agrega y edita. Nadie borra (se desactiva).
create policy "paises: admin ve todos" on public.paises for select to authenticated using (public.is_admin());
create policy "paises: admin agrega" on public.paises for insert to authenticated with check (public.is_admin());
create policy "paises: admin edita" on public.paises for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "grados: admin ve todos" on public.grados for select to authenticated using (public.is_admin());
create policy "grados: admin edita" on public.grados for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "grados_pais: admin ve todos" on public.grados_pais for select to authenticated using (public.is_admin());
create policy "grados_pais: admin agrega" on public.grados_pais for insert to authenticated with check (public.is_admin());
create policy "grados_pais: admin edita" on public.grados_pais for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.paises, public.grados, public.grados_pais to anon, authenticated;
grant insert, update on public.paises, public.grados_pais to authenticated;
-- Los códigos de grados son fijos (los usan las reglas); el admin solo cambia orden y activo.
grant update (orden, activo) on public.grados to authenticated;

-- ═════════════════════════ 5. País del usuario ═════════════════════════

alter table public.profiles add column pais char(2) references public.paises(codigo);

-- ═════════════════════════ 6. Grado y flujo del estudiante ═════════════════════════

alter table public.student_profiles drop constraint if exists student_profiles_grado_check;

-- Valores viejos → códigos nuevos. Egresado, universidad, otro y sin dato → preuniversitario (grado 12).
update public.student_profiles set grado = case grado
  when 'secundaria_3' then 'g09'
  when 'bachillerato_1' then 's01'
  when 'bachillerato_2' then 's02'
  when 'bachillerato_3' then 's03'
  when 'bachillerato_4' then 's04'
  when 'bachillerato_5' then 's05'
  when 'bachillerato_6' then 's06'
  else 'pu'
end;

alter table public.student_profiles
  alter column grado set default 'pu',
  alter column grado set not null,
  add constraint student_profiles_grado_fkey foreign key (grado) references public.grados(codigo),
  add column flujo text not null default 'admision' check (flujo in ('admision', 'escolar'));

-- Igual que antes, pero el grado vacío vuelve a 'pu' y se valida contra el catálogo.
create or replace function public.guardar_mi_perfil(
  p_full_name text,
  p_alias text,
  p_birth_date date,
  p_phone text,
  p_estado text,
  p_origin_school text,
  p_not_studying boolean,
  p_grado text,
  p_promedio numeric
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
  v_edad integer := public.edad(p_birth_date);
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[\s\-\(\)]', '', 'g'), '');
  v_grado text := coalesce(nullif(p_grado, ''), 'pu');
begin
  if length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'Escribe tu nombre completo.' using errcode = '22023';
  end if;
  if v_edad is not null and (v_edad < 10 or v_edad > 100) then
    raise exception 'Revisa tu fecha de nacimiento.' using errcode = '22023';
  end if;
  -- Teléfono solo para mayores de edad (con fecha de nacimiento que lo demuestre).
  if v_phone is not null and (v_edad is null or v_edad < 18) then
    v_phone := null;
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{10,15}$' then
    raise exception 'El teléfono debe tener 10 dígitos (o lada internacional).' using errcode = '22023';
  end if;
  if not exists (select 1 from public.grados g where g.codigo = v_grado and g.activo) then
    raise exception 'Elige un grado de la lista.' using errcode = '22023';
  end if;

  update public.profiles set
    full_name = trim(p_full_name),
    alias = coalesce(nullif(trim(p_alias), ''), split_part(trim(p_full_name), ' ', 1)),
    birth_date = p_birth_date,
    phone = v_phone,
    estado = nullif(trim(coalesce(p_estado, '')), ''),
    updated_at = now()
  where id = v_uid;

  update public.student_profiles set
    origin_school = nullif(trim(coalesce(p_origin_school, '')), ''),
    not_studying = coalesce(p_not_studying, false),
    grado = v_grado,
    promedio = p_promedio,
    updated_at = now()
  where user_id = v_uid;
end;
$$;

-- ═════════════════════════ 7. Lista de grados para un país ═════════════════════════

-- País pedido → país del usuario → México. Solo lo activo, en orden escolar.
create or replace function public.grados_para(p_pais text default null)
returns table (codigo text, tipo text, grado_numero smallint, semestre smallint, nivel text, nombre text, nombre_corto text, pais char(2))
language sql stable security definer set search_path = ''
as $$
  with elegido as (
    select coalesce(
      (select p.codigo from public.paises p where p.codigo = upper(p_pais) and p.activo),
      (select pr.pais from public.profiles pr where pr.id = auth.uid()),
      'MX'
    )::char(2) as pais
  )
  select g.codigo, g.tipo, g.grado_numero, g.semestre, gp.nivel, gp.nombre, gp.nombre_corto, gp.pais
  from elegido e
  join public.grados_pais gp on gp.pais = e.pais and gp.activo
  join public.grados g on g.codigo = gp.grado and g.activo
  order by g.orden;
$$;

revoke all on function public.grados_para(text) from public;
grant execute on function public.grados_para(text) to anon, authenticated;

commit;
