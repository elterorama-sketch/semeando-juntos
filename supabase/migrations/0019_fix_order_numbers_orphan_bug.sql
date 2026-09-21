-- CRITICAL bug found via a real user report (cooperador couldn't sell/
-- confirm numbers, got a mysterious error). Root cause: order_numbers has
-- `unique (campaign_number_id)`, but release_order() and
-- expire_stale_reservations() never delete the order_numbers row when
-- cancelling an order -- they only reset campaign_numbers back to
-- DISPONIVEL. So any number that is ever reserved and then released or
-- left to expire keeps its old order_numbers row forever, and the NEXT
-- attempt to sell that same number (which correctly passes every status
-- check, since campaign_numbers really is DISPONIVEL again) crashes at
-- the final `insert into order_numbers` with
-- "duplicate key value violates unique constraint
-- order_numbers_campaign_number_id_key" -- surfaced to the seller as a
-- generic, unexplained error. Confirmed in production logs: dozens of
-- these errors in a few minutes, and 5 numbers permanently stuck today.

create or replace function release_order(p_order_id uuid)
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

  -- Free the numbers for a future order_numbers insert -- see migration
  -- header for why this was missing before.
  delete from order_numbers where order_id = p_order_id;

  update orders set status = 'CANCELADO', updated_at = now() where id = p_order_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), 'LIBERAR_NUMEROS', 'order', p_order_id,
    jsonb_build_object('status', v_order.status), jsonb_build_object('status', 'CANCELADO'));
end;
$$;

grant execute on function release_order(uuid) to authenticated;

create or replace function expire_stale_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_order record;
begin
  for v_order in
    select distinct o.id
    from orders o
    join campaign_numbers cn on cn.order_id = o.id
    where o.status = 'RESERVADO'
      and cn.expires_at is not null
      and cn.expires_at < now()
  loop
    update campaign_numbers
      set status = 'DISPONIVEL', order_id = null, reserved_by = null, reserved_at = null, expires_at = null, updated_at = now()
      where order_id = v_order.id and status = 'RESERVADO';

    delete from order_numbers where order_id = v_order.id;

    update orders set status = 'CANCELADO', updated_at = now() where id = v_order.id;

    insert into audit_logs (actor_id, action, entity_type, entity_id, new_value)
    values (null, 'RESERVA_EXPIRADA', 'order', v_order.id, jsonb_build_object('motivo', 'expirou automaticamente'));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- One-time cleanup: delete the orphaned order_numbers rows already stuck
-- from cancelled orders whose numbers are back to DISPONIVEL, so those
-- numbers are sellable again immediately (no need to wait for the next
-- release/expiry cycle to touch them).
delete from order_numbers onum
using orders o, campaign_numbers cn
where o.id = onum.order_id
  and cn.id = onum.campaign_number_id
  and o.status = 'CANCELADO'
  and cn.status = 'DISPONIVEL';
