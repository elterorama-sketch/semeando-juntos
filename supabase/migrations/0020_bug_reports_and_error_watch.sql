-- Implementa as prioridades 1 e 2 do plano "Como evitar erros no sistema":
--
-- 1) system_error_reports -- captura automática de erros reais que o
--    cliente recebe do banco/RPC nos fluxos críticos (reservar, vender,
--    confirmar pagamento, liberar número). Até aqui, um erro como o do
--    order_numbers travado só era descoberto quando alguém reclamava.
--    Agora toda falha real nesses fluxos é logada aqui automaticamente
--    pelo próprio cliente (via report_client_error), e fica visível num
--    painel admin (contagem + lista) sem precisar vasculhar logs do
--    Supabase/Vercel manualmente.
--
-- 2) bug_reports -- botão "Reportar problema" dentro do app. Qualquer
--    usuário autenticado pode registrar um problema com tela + descrição
--    livre; só admins veem/gerenciam os reportes.
--
-- Sem provedor de e-mail/SMS configurado neste projeto (ver comentário em
-- api/admin/invite/route.ts), então o "alerta" por enquanto é um contador
-- visível no painel admin, não um e-mail/WhatsApp automático -- isso pode
-- ser plugado depois se um provedor for configurado.

create table if not exists system_error_reports (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  source text not null, -- ex: 'reserve_numbers', 'confirm_payment', 'release_order'
  message text not null,
  context jsonb,
  resolved boolean not null default false,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists system_error_reports_unresolved_idx
  on system_error_reports (created_at desc) where not resolved;

alter table system_error_reports enable row level security;

create policy system_error_reports_admin_select on system_error_reports
  for select using (current_user_role() = 'admin');

create policy system_error_reports_admin_update on system_error_reports
  for update using (current_user_role() = 'admin');

create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  screen text,
  message text not null,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bug_reports_open_idx
  on bug_reports (created_at desc) where status = 'aberto';

alter table bug_reports enable row level security;

create policy bug_reports_admin_select on bug_reports
  for select using (current_user_role() = 'admin');

create policy bug_reports_admin_update on bug_reports
  for update using (current_user_role() = 'admin');

-- Qualquer usuário autenticado pode reportar um erro real de RPC (log
-- automático) ou um problema manual (botão) -- mas só através das funções
-- abaixo, nunca inserindo direto na tabela (por isso não há policy de
-- insert: SECURITY DEFINER contorna RLS de forma controlada).

create or replace function report_client_error(
  p_source text,
  p_message text,
  p_context jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user_role() is null then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  insert into system_error_reports (actor_id, source, message, context)
  values (auth.uid(), p_source, p_message, p_context);
end;
$$;

grant execute on function report_client_error(text, text, jsonb) to authenticated;
revoke all on function report_client_error(text, text, jsonb) from anon;

create or replace function report_bug(
  p_screen text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user_role() is null then
    raise exception 'PERMISSAO_NEGADA';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'DESCRICAO_OBRIGATORIA';
  end if;

  insert into bug_reports (reporter_id, screen, message)
  values (auth.uid(), p_screen, left(trim(p_message), 2000));
end;
$$;

grant execute on function report_bug(text, text) to authenticated;
revoke all on function report_bug(text, text) from anon;

create or replace function resolve_bug_report(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user_role() <> 'admin' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  update bug_reports
    set status = 'resolvido', resolved_by = auth.uid(), resolved_at = now()
    where id = p_id;
end;
$$;

grant execute on function resolve_bug_report(uuid) to authenticated;
revoke all on function resolve_bug_report(uuid) from anon;

create or replace function resolve_system_error(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user_role() <> 'admin' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  update system_error_reports
    set resolved = true, resolved_by = auth.uid(), resolved_at = now()
    where id = p_id;
end;
$$;

grant execute on function resolve_system_error(uuid) to authenticated;
revoke all on function resolve_system_error(uuid) from anon;
