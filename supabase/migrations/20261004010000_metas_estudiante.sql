-- Entrena Mente · Metas del estudiante: varias carreras (Universidad → Carrera) en su perfil.
-- Pegar completo en Supabase → SQL Editor → Run (una sola vez).
--
--   · student_goals sigue siendo la fuente: (user_id, university_id, career_id, is_initial). El cliente solo
--     la lee (RLS "goals: ver las propias"); escribir pasa por estas funciones.
--   · Tope: 5 carreras simultáneas (metas_maximas()), también para lo que agrega el tutor.
--   · Sin licencia vigente (Demo) se mantiene 1 sola: puede cambiarla, no agregar ni quitar.
--   · Con licencia: agregar hasta 5, cambiar y quitar (siempre queda al menos 1).
--   · Una carrera con plan activo no se cambia ni se quita: primero se cancela el plan.
--   · Si se quita la meta inicial, la más antigua que queda pasa a ser la inicial (las pruebas gratis
--     del Demo usan la inicial).

create or replace function public.metas_maximas()
returns integer
language sql immutable
as $$ select 5 $$;

-- Carrera activa del catálogo oficial → su institución (null si no está disponible).
create or replace function public.institucion_de_carrera(p_carrera text)
returns text
language sql stable security definer set search_path = ''
as $$
  select c.institucion_id
  from public.carreras c join public.instituciones i on i.id = c.institucion_id
  where c.id = p_carrera and c.activo and i.activo;
$$;
revoke execute on function public.institucion_de_carrera(text) from public, anon, authenticated;

-- Usuario actual con su fila bloqueada: serializa altas/bajas simultáneas del mismo alumno.
create or replace function public.exigir_alumno_metas()
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Inicia sesión para editar tus carreras.' using errcode = '42501';
  end if;
  perform 1 from public.profiles where id = v_uid for update;
  return v_uid;
end;
$$;
revoke execute on function public.exigir_alumno_metas() from public, anon, authenticated;

create or replace function public.exigir_plan_estudiante()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if coalesce((select status from public.get_my_access()), 'inactive') <> 'active' then
    raise exception 'Entrena para varias universidades desbloqueando tu Plan Estudiante.' using errcode = 'P0402';
  end if;
end;
$$;
revoke execute on function public.exigir_plan_estudiante() from public, anon, authenticated;

create or replace function public.exigir_meta_sin_plan(p_uid uuid, p_carrera text)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.student_plans
    where student_id = p_uid and career_id = p_carrera and status = 'active'
  ) then
    raise exception 'Esta carrera tiene un plan activo. Cancélalo antes de cambiarla o quitarla.' using errcode = '23503';
  end if;
end;
$$;
revoke execute on function public.exigir_meta_sin_plan(uuid, text) from public, anon, authenticated;

-- ═════════════════════════ RPC del alumno ═════════════════════════

create or replace function public.agregar_meta(p_carrera text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_alumno_metas();
  v_inst text := public.institucion_de_carrera(p_carrera);
  v_total integer;
begin
  perform public.exigir_plan_estudiante();
  if v_inst is null then
    raise exception 'La carrera no está disponible.' using errcode = '23503';
  end if;
  if exists (select 1 from public.student_goals where user_id = v_uid and career_id = p_carrera) then
    raise exception 'Esa carrera ya es una de tus metas.' using errcode = '23505';
  end if;
  select count(*) into v_total from public.student_goals where user_id = v_uid;
  if v_total >= public.metas_maximas() then
    raise exception 'Has alcanzado el límite máximo de % carreras simultáneas.', public.metas_maximas() using errcode = '23514';
  end if;
  insert into public.student_goals (user_id, university_id, career_id, is_initial)
  values (v_uid, v_inst, p_carrera, v_total = 0);
end;
$$;

-- Reemplaza una meta por otra en su mismo lugar (conserva si es la inicial y su antigüedad).
create or replace function public.cambiar_meta(p_actual text, p_nueva text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_alumno_metas();
  v_inst text := public.institucion_de_carrera(p_nueva);
begin
  if not exists (select 1 from public.student_goals where user_id = v_uid and career_id = p_actual) then
    raise exception 'Esa carrera no está en tus metas.' using errcode = '02000';
  end if;
  if p_actual = p_nueva then
    return;
  end if;
  if v_inst is null then
    raise exception 'La carrera no está disponible.' using errcode = '23503';
  end if;
  if exists (select 1 from public.student_goals where user_id = v_uid and career_id = p_nueva) then
    raise exception 'Esa carrera ya es una de tus metas.' using errcode = '23505';
  end if;
  perform public.exigir_meta_sin_plan(v_uid, p_actual);
  update public.student_goals
  set university_id = v_inst, career_id = p_nueva
  where user_id = v_uid and career_id = p_actual;
end;
$$;

create or replace function public.quitar_meta(p_carrera text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_alumno_metas();
  v_era_inicial boolean;
begin
  perform public.exigir_plan_estudiante();
  select is_initial into v_era_inicial from public.student_goals where user_id = v_uid and career_id = p_carrera;
  if not found then
    raise exception 'Esa carrera no está en tus metas.' using errcode = '02000';
  end if;
  if (select count(*) from public.student_goals where user_id = v_uid) <= 1 then
    raise exception 'Necesitas al menos una carrera. Cámbiala en lugar de quitarla.' using errcode = '23514';
  end if;
  perform public.exigir_meta_sin_plan(v_uid, p_carrera);
  delete from public.student_goals where user_id = v_uid and career_id = p_carrera;
  if v_era_inicial then
    update public.student_goals set is_initial = true
    where id = (select id from public.student_goals where user_id = v_uid order by created_at, id limit 1);
  end if;
end;
$$;

revoke execute on function public.agregar_meta(text) from public, anon;
revoke execute on function public.cambiar_meta(text, text) from public, anon;
revoke execute on function public.quitar_meta(text) from public, anon;
grant execute on function public.agregar_meta(text) to authenticated;
grant execute on function public.cambiar_meta(text, text) to authenticated;
grant execute on function public.quitar_meta(text) to authenticated;

-- ═════════════════════════ Tutor: mismo tope de 5 ═════════════════════════

create or replace function public.agregar_meta_tutor(p_estudiante uuid, p_carrera text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_inst text;
begin
  perform public.exigir_tutor_con_plan(p_estudiante);
  perform 1 from public.profiles where id = p_estudiante for update;
  v_inst := public.institucion_de_carrera(p_carrera);
  if v_inst is null then
    raise exception 'La carrera no está disponible.' using errcode = '23503';
  end if;
  if exists (select 1 from public.student_goals where user_id = p_estudiante and career_id = p_carrera) then
    raise exception 'Esa carrera ya es una de sus metas.' using errcode = '23505';
  end if;
  if (select count(*) from public.student_goals where user_id = p_estudiante) >= public.metas_maximas() then
    raise exception 'Ya tiene el límite máximo de % carreras simultáneas.', public.metas_maximas() using errcode = '23514';
  end if;
  insert into public.student_goals (user_id, university_id, career_id, is_initial)
  values (p_estudiante, v_inst, p_carrera, false);
end;
$$;
