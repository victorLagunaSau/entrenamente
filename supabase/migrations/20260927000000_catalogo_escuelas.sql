-- Entrena Mente · Catálogo de instituciones (universidades y exámenes especiales), áreas y carreras.
--
-- Se corre DESPUÉS de 20260926000000_usuarios_licencias.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué agrega:
--   · instituciones: UNAM, TEC, TOEFL… La clave es el prefijo de los IDs de reactivos (UNAM-A1-MAT-007-V01).
--   · areas: agrupan carreras dentro de una institución (UNAM: A1…A4). Opcionales.
--   · carreras: la meta del estudiante. En un examen especial es la edición ("TOEFL 2026").
--   · Semilla con el catálogo estático del front (mismos ids que ya guardan student_goals e invites).
--
-- No se borra nada desde el cliente: se desactiva (hay estudiantes con esas metas).
-- Lectura pública (anon incluido, lo usa el registro) solo de filas activas; el admin ve y edita todo.

begin;

-- ═════════════════════════ 1. Tablas ═════════════════════════

create table public.instituciones (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),          -- slug estable, nunca cambia
  clave text not null unique check (clave ~ '^[A-Z0-9]{2,12}$'),         -- prefijo de los IDs de reactivos
  nombre text not null check (length(trim(nombre)) > 0),
  tipo text not null default 'universidad' check (tipo in ('universidad', 'examen_especial')),
  examen text,                                                           -- nombre del examen de admisión si no es el genérico (TEC → PAA)
  color_id text check (color_id ~ '^[a-z0-9-]+$'),                       -- sufijo de --uni-* en globals.css
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.areas (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  institucion_id text not null references public.instituciones(id),
  codigo text not null check (codigo ~ '^[A-Z0-9]{1,12}$'),              -- A1, A2… (segundo bloque del ID de reactivo)
  nombre text not null check (length(trim(nombre)) > 0),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institucion_id, codigo),
  unique (id, institucion_id)                                            -- destino de la FK compuesta de carreras
);

create table public.carreras (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  institucion_id text not null references public.instituciones(id),
  area_id text,
  nombre text not null check (length(trim(nombre)) > 0),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- El área (si hay) debe ser de la misma institución. Con area_id null la FK no aplica (MATCH SIMPLE).
  foreign key (area_id, institucion_id) references public.areas(id, institucion_id)
);

-- Sin carreras repetidas por institución (ignorando mayúsculas y espacios).
create unique index carreras_nombre_unico on public.carreras (institucion_id, lower(trim(nombre)));
create index carreras_institucion_idx on public.carreras (institucion_id, area_id);

create trigger instituciones_touch before update on public.instituciones
  for each row execute function public.touch_updated_at();
create trigger areas_touch before update on public.areas
  for each row execute function public.touch_updated_at();
create trigger carreras_touch before update on public.carreras
  for each row execute function public.touch_updated_at();

-- ═════════════════════════ 2. Semilla (catálogo estático del front) ═════════════════════════

insert into public.instituciones (id, clave, nombre, tipo, examen, color_id, orden) values
  ('unam',  'UNAM',  'Universidad Nacional Autónoma de México', 'universidad',     null,  'unam', 10),
  ('ipn',   'IPN',   'Instituto Politécnico Nacional',          'universidad',     null,  'ipn',  20),
  ('uam',   'UAM',   'Universidad Autónoma Metropolitana',      'universidad',     null,  'uam',  30),
  ('uvm',   'UVM',   'Universidad del Valle de México',         'universidad',     null,  'uvm',  40),
  ('tec',   'TEC',   'Tec de Monterrey',                        'universidad',     'PAA', 'tec',  50),
  ('udg',   'UDG',   'Universidad de Guadalajara',              'universidad',     null,  'udg',  60),
  ('toefl', 'TOEFL', 'Test of English as a Foreign Language',   'examen_especial', null,  null,   70);

insert into public.areas (id, institucion_id, codigo, nombre, orden) values
  ('unam-a1', 'unam', 'A1', 'Ciencias Físico Matemáticas y de las Ingenierías', 1),
  ('unam-a2', 'unam', 'A2', 'Ciencias Biológicas, Químicas y de la Salud',      2),
  ('unam-a3', 'unam', 'A3', 'Ciencias Sociales',                                3),
  ('unam-a4', 'unam', 'A4', 'Humanidades y de las Artes',                       4);

insert into public.carreras (id, institucion_id, area_id, nombre, orden) values
  ('unam-medicina',        'unam', 'unam-a2', 'Médico Cirujano',            1),
  ('unam-derecho',         'unam', 'unam-a3', 'Derecho',                    2),
  ('unam-psicologia',      'unam', 'unam-a2', 'Psicología',                 3),
  ('unam-arquitectura',    'unam', 'unam-a4', 'Arquitectura',               4),
  ('unam-actuaria',        'unam', 'unam-a1', 'Actuaría',                   5),
  ('unam-ing-computacion', 'unam', 'unam-a1', 'Ingeniería en Computación',  6),
  ('unam-contaduria',      'unam', 'unam-a3', 'Contaduría',                 7),

  ('ipn-sistemas',   'ipn', null, 'Ingeniería en Sistemas Computacionales', 1),
  ('ipn-mecatronica','ipn', null, 'Ingeniería Mecatrónica',                 2),
  ('ipn-medico',     'ipn', null, 'Médico Cirujano y Partero',              3),
  ('ipn-civil',      'ipn', null, 'Ingeniería Civil',                       4),
  ('ipn-negocios',   'ipn', null, 'Negocios Internacionales',               5),

  ('uam-diseno',         'uam', null, 'Diseño de la Comunicación Gráfica', 1),
  ('uam-administracion', 'uam', null, 'Administración',                    2),
  ('uam-nutricion',      'uam', null, 'Nutrición Humana',                  3),
  ('uam-ing-biomedica',  'uam', null, 'Ingeniería Biomédica',              4),

  ('uvm-odontologia',   'uvm', null, 'Odontología',   1),
  ('uvm-mercadotecnia', 'uvm', null, 'Mercadotecnia', 2),
  ('uvm-gastronomia',   'uvm', null, 'Gastronomía',   3),

  ('tec-itc', 'tec', null, 'Ingeniería en Tecnologías Computacionales', 1),
  ('tec-lae', 'tec', null, 'Administración y Estrategia',               2),
  ('tec-imt', 'tec', null, 'Ingeniería en Mecatrónica',                 3),
  ('tec-lri', 'tec', null, 'Relaciones Internacionales',                4),

  ('udg-medicina',    'udg', null, 'Medicina',               1),
  ('udg-enfermeria',  'udg', null, 'Enfermería',             2),
  ('udg-abogado',     'udg', null, 'Abogado',                3),
  ('udg-informatica', 'udg', null, 'Ingeniería Informática', 4),

  ('toefl-2026', 'toefl', null, 'TOEFL 2026', 1);

-- ═════════════════════════ 3. Seguridad (RLS y permisos) ═════════════════════════

alter table public.instituciones enable row level security;
alter table public.areas enable row level security;
alter table public.carreras enable row level security;

-- Lectura pública: solo lo activo y colgado de una institución activa.
create policy "instituciones: activas" on public.instituciones
  for select to anon, authenticated using (activo);
create policy "areas: activas" on public.areas
  for select to anon, authenticated
  using (activo and exists (select 1 from public.instituciones i where i.id = institucion_id and i.activo));
create policy "carreras: activas" on public.carreras
  for select to anon, authenticated
  using (activo and exists (select 1 from public.instituciones i where i.id = institucion_id and i.activo));

-- Admin: ve todo, da de alta y edita. Nadie borra (se desactiva).
create policy "instituciones: admin ve todas" on public.instituciones
  for select to authenticated using (public.is_admin());
create policy "instituciones: admin agrega" on public.instituciones
  for insert to authenticated with check (public.is_admin());
create policy "instituciones: admin edita" on public.instituciones
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "areas: admin ve todas" on public.areas
  for select to authenticated using (public.is_admin());
create policy "areas: admin agrega" on public.areas
  for insert to authenticated with check (public.is_admin());
create policy "areas: admin edita" on public.areas
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "carreras: admin ve todas" on public.carreras
  for select to authenticated using (public.is_admin());
create policy "carreras: admin agrega" on public.carreras
  for insert to authenticated with check (public.is_admin());
create policy "carreras: admin edita" on public.carreras
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Supabase da todos los privilegios por defecto; se dejan solo los necesarios.
-- Los ids y la institución de un área/carrera no se editan (los guardan metas, invitaciones y reactivos).
revoke all on public.instituciones, public.areas, public.carreras from anon, authenticated;
grant select on public.instituciones, public.areas, public.carreras to anon, authenticated;
grant insert on public.instituciones, public.areas, public.carreras to authenticated;
grant update (clave, nombre, tipo, examen, color_id, activo, orden) on public.instituciones to authenticated;
grant update (codigo, nombre, activo, orden) on public.areas to authenticated;
grant update (area_id, nombre, activo, orden) on public.carreras to authenticated;

commit;
