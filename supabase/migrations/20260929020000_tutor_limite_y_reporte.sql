-- Entrena Mente · Home Padre / Maestro: límite de estudiantes por plan y reporte de examen para el tutor.
--
-- Se corre DESPUÉS de 20260929010000_panel_tutor_prueba.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · limite_estudiantes_tutor(): cuántos estudiantes puede vincular el tutor = cupos de su licencia vigente;
--     sin plan (demo), 1. Para invitar a otro hay que ampliar el plan.
--   · invitacion_tutor(): ya no entrega enlace si el tutor llegó a su límite.
--   · get_invite(): una invitación de licencia de un tutor lleno deja de ser válida (el alumno se registra normal).
--   · tutor_students: un trigger descarta el vínculo si el tutor ya está lleno (red de seguridad del registro).
--   · estadisticas_tutor(): agrega prueba_numero ("Prueba gratuita N"); cambia su forma, así que se recrea.
--   · examen_tutor(): el examen congelado completo (preguntas, fallas, soluciones) de un estudiante vinculado,
--     para el resumen final y la guía de estudio en el panel del padre.

begin;

-- ═════════════════════════ 1. Límite de estudiantes ═════════════════════════

create or replace function public.limite_estudiantes_tutor(p_owner uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select l.seats from public.licenses l
    where l.owner_id = p_owner and l.status = 'active' and l.expires_at > now()
    order by l.seats desc limit 1
  ), 1);
$$;

create or replace function public.tutor_lleno(p_owner uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select count(*) from public.tutor_students where owner_id = p_owner) >= public.limite_estudiantes_tutor(p_owner);
$$;

-- Red de seguridad: si el tutor está lleno, el vínculo no se crea (el registro del alumno sigue normal).
create or replace function public.tutor_students_limite()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.tutor_lleno(new.owner_id) then
    return null;
  end if;
  return new;
end;
$$;

create trigger tutor_students_limite before insert on public.tutor_students
  for each row execute function public.tutor_students_limite();

create or replace function public.get_invite(p_code text)
returns table (code text, parent_name text, university_id text, career_id text, sponsored boolean)
language sql stable security definer set search_path = ''
as $$
  select i.code, p.full_name, i.university_id, i.career_id,
         coalesce((
           select l.status = 'active' and l.expires_at > now()
                  and (select count(*) from public.license_seats s
                       where s.license_id = l.id and s.released_at is null) < l.seats
           from public.licenses l where l.id = i.license_id
         ), false)
  from public.invites i
  join public.profiles p on p.id = i.parent_id
  where i.code = upper(trim(p_code)) and (i.reusable or i.redeemed_by is null) and i.expires_at > now()
    and (not i.reusable or not public.tutor_lleno(i.parent_id));
$$;

create or replace function public.invitacion_tutor(p_nuevo boolean default false)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_lic public.licenses := public.licencia_tutor(v_uid);
  v_license uuid;
  v_code text;
begin
  if public.tutor_lleno(v_uid) then
    raise exception 'Ya tienes el máximo de estudiantes de tu plan. Amplía tu plan para invitar a otro.' using errcode = 'P0001';
  end if;

  v_license := case when v_lic.status = 'active' and v_lic.expires_at > now() then v_lic.id end;

  if p_nuevo then
    update public.invites set expires_at = now()
    where parent_id = v_uid and reusable and expires_at > now();
  else
    select code into v_code from public.invites
    where parent_id = v_uid and reusable and expires_at > now() and license_id is not distinct from v_license
    order by created_at desc limit 1;
    if v_code is not null then
      return v_code;
    end if;
  end if;

  v_code := public.nuevo_codigo_invitacion();
  insert into public.invites (code, parent_id, license_id, reusable, expires_at)
  values (v_code, v_uid, v_license, true,
          case when v_license is not null then least(v_lic.expires_at, now() + interval '90 days')
               else now() + interval '90 days' end);
  return v_code;
end;
$$;

-- ═════════════════════════ 2. Estadísticas con número de prueba ═════════════════════════

drop function public.estadisticas_tutor(uuid[]);
create function public.estadisticas_tutor(p_estudiantes uuid[] default null)
returns table (
  id bigint,
  student_id uuid,
  folio text,
  exam_type text,
  prueba_numero smallint,
  university_key text,
  career_name text,
  level text,
  total_questions integer,
  answered_questions integer,
  score_achieved numeric,
  max_score numeric,
  time_spent_seconds integer,
  completed_at timestamptz,
  resumen_por_materia jsonb
)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.student_id, e.folio, e.exam_type, e.prueba_numero, e.university_key, e.career_name, e.level,
         e.total_questions, e.answered_questions, e.score_achieved, e.max_score, e.time_spent_seconds,
         e.completed_at, coalesce(e.frozen_exam_data->'resumen_por_materia', '[]'::jsonb)
  from public.exam_history e
  join public.tutor_students t on t.student_id = e.student_id and t.owner_id = public.exigir_tutor()
  where p_estudiantes is null or e.student_id = any (p_estudiantes)
  order by e.completed_at;
$$;

-- ═════════════════════════ 3. Examen completo para el tutor ═════════════════════════

-- Misma forma que una fila de exam_history (el cliente reutiliza el reporte del alumno).
create or replace function public.examen_tutor(p_examen bigint)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_row jsonb;
begin
  select to_jsonb(e) into v_row
  from public.exam_history e
  join public.tutor_students t on t.student_id = e.student_id and t.owner_id = v_uid
  where e.id = p_examen;
  if v_row is null then
    raise exception 'Examen no encontrado.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- ═════════════════════════ 4. Permisos ═════════════════════════

revoke execute on function public.limite_estudiantes_tutor(uuid) from public, anon, authenticated;
revoke execute on function public.tutor_lleno(uuid) from public, anon, authenticated;
revoke execute on function public.tutor_students_limite() from public, anon, authenticated;
revoke execute on function public.estadisticas_tutor(uuid[]) from public, anon;
revoke execute on function public.examen_tutor(bigint) from public, anon;
grant execute on function public.estadisticas_tutor(uuid[]) to authenticated;
grant execute on function public.examen_tutor(bigint) to authenticated;

commit;
