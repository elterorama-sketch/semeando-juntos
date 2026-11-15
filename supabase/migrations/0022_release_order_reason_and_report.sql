-- Duas melhorias pedidas pelo usuário:
--
-- 1) "Opção de cancelar compra, retornando os números" -- já existia
--    via release_order() (qualquer admin/tesoureiro pode liberar um
--    número mesmo PAGO, devolvendo pro estoque), só não capturava o
--    motivo do cancelamento. Adiciona p_reason opcional, gravado em
--    audit_logs.new_value para aparecer no relatório abaixo.
--
-- 2) "Relatório das reservas canceladas" -- não existia nenhuma visão
--    agregada de pedidos CANCELADO; minhas-vendas, compradores e o CSV
--    de exportação excluem CANCELADO de propósito (são relatórios do
--    que está em aberto/vendido). Este relatório é o complemento: só
--    cancelamentos, com quem cancelou e por quê (quando veio de
--    release_order) ou que expirou sozinho (quando veio de
--    expire_stale_reservations, que já grava motivo desde a migração
--    0007).

-- Drop the old one-arg signature first -- "create or replace" with a
-- different parameter list creates a SECOND overload instead of
-- replacing it, and PostgREST can't disambiguate two release_order
-- candidates when called with just p_order_id.
drop function if exists release_order(uuid);

create or replace function release_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_role user_role;
begin
  v_role := current_user_role();
  if v_role is null then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
  end if;

  if v_order.status = 'PAGO' and v_role <> 'admin' then
    raise exception 'PERMISSAO_NEGADA: somente administracao pode liberar um numero ja pago';
  end if;

  if v_role = 'seller' and v_order.seller_id <> auth.uid() then
    raise exception 'PERMISSAO_NEGADA: voce so pode liberar suas proprias reservas';
  end if;

  update campaign_numbers
    set status = 'DISPONIVEL', order_id = null, reserved_by = null, reserved_at = null, expires_at = null, updated_at = now()
    where order_id = p_order_id;

  delete from order_numbers where order_id = p_order_id;

  update orders set status = 'CANCELADO', updated_at = now() where id = p_order_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), 'LIBERAR_NUMEROS', 'order', p_order_id,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'CANCELADO', 'motivo', nullif(trim(p_reason), '')));
end;
$$;

grant execute on function release_order(uuid, text) to authenticated;
revoke execute on function release_order(uuid, text) from public;
revoke all on function release_order(uuid, text) from anon;
