-- Entrena Mente · Folio de los exámenes presentados.
--
-- Se corre DESPUÉS de 20260927040000_examen_libre.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run.
--
-- Cada fila de exam_history recibe un folio legible y difícil de adivinar (EM-7F3K-9Q2D) para
-- identificar, compartir y consultar el examen en el futuro. Los exámenes ya guardados reciben
-- el suyo al correr esta migración (no es un UPDATE: el historial sigue inmutable).
-- La lectura sigue limitada por RLS: el folio identifica, no da acceso.

begin;

-- Sin 0/O ni 1/I para que se pueda dictar y copiar sin errores.
create or replace function public.nuevo_folio_examen()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'EM-' || substr(c, 1, 4) || '-' || substr(c, 5, 4)
  from (
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') as c
    from generate_series(1, 8)
  ) x;
$$;

alter table public.exam_history
  add column folio text not null default public.nuevo_folio_examen();

alter table public.exam_history
  add constraint exam_history_folio_key unique (folio);

revoke execute on function public.nuevo_folio_examen() from public, anon, authenticated;

commit;
