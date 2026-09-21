-- Vulnerabilidade real encontrada numa varredura de segurança pós-
-- implantação (migração 0020, aplicada ontem): resolve_bug_report() e
-- resolve_system_error() checavam permissão com
--   if current_user_role() <> 'admin' then raise exception ... end if;
-- Para um chamador ANÔNIMO, current_user_role() retorna NULL (não há
-- linha em profiles para auth.uid() = NULL). Em SQL, `NULL <> 'admin'`
-- avalia para NULL, e o PL/pgSQL trata `IF NULL` como falso -- a
-- exceção nunca dispara. A execução cai direto no UPDATE, que roda com
-- o privilégio do dono da função (SECURITY DEFINER), contornando a RLS
-- das tabelas bug_reports/system_error_reports. Resultado: qualquer
-- requisição anônima pra /rest/v1/rpc/resolve_bug_report ou
-- /rest/v1/rpc/resolve_system_error com um p_id válido marcava aquele
-- registro como resolvido, sem autenticação nenhuma.
--
-- release_order() (migração 0007) já fazia a checagem certa -- checar
-- `is null` primeiro (rejeita anônimo), só depois `<> 'admin'` (rejeita
-- autenticado não-admin). As duas funções novas não seguiram esse
-- padrão; corrigido aqui.
--
-- Também fecha o mesmo gap de GRANT que a migração
-- 0018_tighten_function_grants.sql fechou para as funções mais antigas:
-- o Postgres concede EXECUTE a PUBLIC por padrão na criação de toda
-- função, e anon/authenticated herdam de PUBLIC -- então "revoke ...
-- from anon" sozinho (como em 0020) não é suficiente.

create or replace function resolve_bug_report(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
begin
  v_role := current_user_role();
  if v_role is null then
    raise exception 'PERMISSAO_NEGADA';
  end if;
  if v_role <> 'admin' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  update bug_reports
    set status = 'resolvido', resolved_by = auth.uid(), resolved_at = now()
    where id = p_id;
end;
$$;

create or replace function resolve_system_error(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
begin
  v_role := current_user_role();
  if v_role is null then
    raise exception 'PERMISSAO_NEGADA';
  end if;
  if v_role <> 'admin' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  update system_error_reports
    set resolved = true, resolved_by = auth.uid(), resolved_at = now()
    where id = p_id;
end;
$$;

-- Fecha o gap de GRANT EXECUTE em PUBLIC nas 4 funções da migração 0020
-- (as duas de report_* já tinham a checagem `is null` certa, mas ainda
-- estavam com o mesmo gap de GRANT).
revoke execute on function report_bug(text, text) from public;
revoke execute on function report_client_error(text, text, jsonb) from public;
revoke execute on function resolve_bug_report(uuid) from public;
revoke execute on function resolve_system_error(uuid) from public;

revoke all on function resolve_bug_report(uuid) from anon;
revoke all on function resolve_system_error(uuid) from anon;

grant execute on function resolve_bug_report(uuid) to authenticated;
grant execute on function resolve_system_error(uuid) to authenticated;
