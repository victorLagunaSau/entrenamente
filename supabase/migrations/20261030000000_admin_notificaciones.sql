-- Administrador de notificaciones (/admin/notificaciones): el equipo manda avisos a usuarios específicos o a grupos.
-- · Dos tipos: "aviso" (N1, le llega a todo el público elegido) y "promoción" (M1, solo a mayores de edad que
--   aceptaron promociones; lo decide notificar()).
-- · Público: usuarios específicos (hasta 200) o filtro por tipo de usuario, Pro/Demo e institución o carrera meta.
-- · notification_campaigns: historial (quién, cuándo, a cuántos). Cada aviso lleva dedupe_key 'C:<id>', así se
--   cuentan las lecturas y se puede retirar el envío completo.
-- · admin_contar_audiencia() antes de mandar; admin_enviar_notificacion(); admin_campanas(); admin_retirar_campana().

begin;

insert into public.notification_events (code, categoria, critico, canales, descripcion) values
  ('N1', 'cuenta',    true,  '{in_app,push}', 'Aviso del equipo de Entrena Mente (admin)'),
  ('M1', 'marketing', false, '{in_app,push}', 'Promoción del equipo de Entrena Mente (admin)')
on conflict (code) do nothing;

create table public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('aviso', 'promocion')),
  title varchar(150) not null,
  body text not null,
  action_url text check (action_url is null or action_url ~ '^/'),
  audiencia jsonb not null,
  audiencia_resumen text not null,
  destinatarios integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  retirada_at timestamptz
);
alter table public.notification_campaigns enable row level security;
revoke all on public.notification_campaigns from public, anon, authenticated;

create index notifications_dedupe_idx on public.notifications (dedupe_key) where dedupe_key like 'C:%';

-- ¿Tiene acceso Pro hoy? (lugar en una licencia vigente o licencia propia vigente)
create or replace function public.tiene_plan_vigente(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.license_seats s join public.licenses l on l.id = s.license_id
    where s.student_id = p_user and s.released_at is null and l.status = 'active' and l.expires_at > now()
  ) or exists (
    select 1 from public.licenses l where l.owner_id = p_user and l.status = 'active' and l.expires_at > now()
  )
$$;

-- Público de un envío.
--   { "modo": "usuarios", "ids": [uuid…] }
--   { "modo": "filtro", "tipos": ["student","parent","teacher"], "plan": "todos|pro|demo",
--     "institucion": "unam" | null, "carrera": "unam-medicina" | null }   (institución/carrera = meta del estudiante)
create or replace function public.audiencia_notificacion(p jsonb)
returns table (user_id uuid)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tipos text[];
  v_plan text := coalesce(p ->> 'plan', 'todos');
  v_inst text := nullif(p ->> 'institucion', '');
  v_carrera text := nullif(p ->> 'carrera', '');
begin
  if p ->> 'modo' = 'usuarios' then
    return query
      select pr.id from public.profiles pr
      where pr.id in (select (jsonb_array_elements_text(coalesce(p -> 'ids', '[]'::jsonb)))::uuid);
    return;
  end if;
  if p ->> 'modo' is distinct from 'filtro' then
    raise exception 'Público no válido.' using errcode = '22023';
  end if;
  select coalesce(array_agg(t), '{}') into v_tipos
  from jsonb_array_elements_text(coalesce(p -> 'tipos', '[]'::jsonb)) t
  where t in ('student', 'parent', 'teacher');
  if cardinality(v_tipos) = 0 then v_tipos := array['student', 'parent', 'teacher']; end if;
  if v_plan not in ('todos', 'pro', 'demo') then raise exception 'Plan no válido.' using errcode = '22023'; end if;

  return query
    select pr.id from public.profiles pr
    where pr.user_type::text = any (v_tipos)
      and (v_plan = 'todos' or public.tiene_plan_vigente(pr.id) = (v_plan = 'pro'))
      and (
        (v_inst is null and v_carrera is null)
        or exists (
          select 1 from public.student_goals g
          where g.user_id = pr.id
            and (v_carrera is null or g.career_id = v_carrera)
            and (v_inst is null or g.university_id = v_inst)
        )
      );
end;
$$;

-- Cuántos lo recibirían. En promociones, "alcanzables" descuenta menores y quien no aceptó promociones.
create or replace function public.admin_contar_audiencia(p_audiencia jsonb, p_tipo text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_total integer;
  v_alcanzables integer;
begin
  perform public.exigir_admin();
  select count(*),
         count(*) filter (where p_tipo <> 'promocion' or (
           coalesce(public.edad(pr.birth_date), 0) >= 18
           and coalesce((pr.notification_prefs -> 'categorias' ->> 'marketing')::boolean, false)
         ))
  into v_total, v_alcanzables
  from public.audiencia_notificacion(p_audiencia) a join public.profiles pr on pr.id = a.user_id;
  return jsonb_build_object('total', v_total, 'alcanzables', v_alcanzables);
end;
$$;

create or replace function public.admin_enviar_notificacion(
  p_tipo text, p_title text, p_body text, p_action_url text, p_audiencia jsonb, p_resumen text
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_admin uuid := public.exigir_admin();
  v_id uuid;
  v_code text;
  v_url text := nullif(trim(p_action_url), '');
  v_enviados integer := 0;
  r record;
begin
  if p_tipo not in ('aviso', 'promocion') then raise exception 'Tipo no válido.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_title, ''))) not between 3 and 150 then
    raise exception 'El título debe tener entre 3 y 150 caracteres.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_body, ''))) not between 3 and 500 then
    raise exception 'El mensaje debe tener entre 3 y 500 caracteres.' using errcode = '22023';
  end if;
  if v_url is not null and v_url !~ '^/' then
    raise exception 'El enlace debe ser una ruta de Entrena Mente (empieza con /).' using errcode = '22023';
  end if;
  if p_audiencia ->> 'modo' = 'usuarios' and jsonb_array_length(coalesce(p_audiencia -> 'ids', '[]'::jsonb)) not between 1 and 200 then
    raise exception 'Elige entre 1 y 200 usuarios.' using errcode = '22023';
  end if;

  v_code := case p_tipo when 'aviso' then 'N1' else 'M1' end;
  insert into public.notification_campaigns (tipo, title, body, action_url, audiencia, audiencia_resumen, created_by)
  values (p_tipo, trim(p_title), trim(p_body), v_url, p_audiencia, left(coalesce(nullif(trim(p_resumen), ''), 'Público'), 300), v_admin)
  returning id into v_id;

  for r in select a.user_id from public.audiencia_notificacion(p_audiencia) a loop
    if public.notificar(r.user_id, v_code, trim(p_title), trim(p_body), v_url, 'C:' || v_id) is not null then
      v_enviados := v_enviados + 1;
    end if;
  end loop;

  update public.notification_campaigns set destinatarios = v_enviados where id = v_id;
  return jsonb_build_object('id', v_id, 'enviados', v_enviados);
end;
$$;

-- Historial con lecturas al momento (se cuentan sobre las bandejas: la limpieza diaria baja los números con el tiempo).
create or replace function public.admin_campanas(p_limite integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.exigir_admin();
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.created_at desc)
    from (
      select c.id, c.tipo, c.title, c.body, c.action_url, c.audiencia_resumen, c.destinatarios, c.created_at,
             c.retirada_at, coalesce(nullif(trim(p.alias), ''), p.full_name, 'Admin') as enviado_por,
             (select count(*) from public.notifications n where n.dedupe_key = 'C:' || c.id and n.read_at is not null) as leidas
      from public.notification_campaigns c
      left join public.profiles p on p.id = c.created_by
      order by c.created_at desc
      limit least(greatest(p_limite, 1), 100)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- Lo quita de todas las bandejas (no se puede deshacer).
create or replace function public.admin_retirar_campana(p_id uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  perform public.exigir_admin();
  delete from public.notifications where dedupe_key = 'C:' || p_id;
  get diagnostics v_n = row_count;
  update public.notification_campaigns set retirada_at = now() where id = p_id and retirada_at is null;
  return v_n;
end;
$$;

revoke execute on function public.tiene_plan_vigente(uuid) from public, anon, authenticated;
revoke execute on function public.audiencia_notificacion(jsonb) from public, anon, authenticated;
revoke execute on function public.admin_contar_audiencia(jsonb, text) from public, anon;
revoke execute on function public.admin_enviar_notificacion(text, text, text, text, jsonb, text) from public, anon;
revoke execute on function public.admin_campanas(integer) from public, anon;
revoke execute on function public.admin_retirar_campana(uuid) from public, anon;
grant execute on function public.admin_contar_audiencia(jsonb, text) to authenticated;
grant execute on function public.admin_enviar_notificacion(text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.admin_campanas(integer) to authenticated;
grant execute on function public.admin_retirar_campana(uuid) to authenticated;

commit;

-- Verificación: deben salir los dos eventos nuevos.
select code, categoria, critico from public.notification_events where code in ('N1', 'M1') order by code;
