-- "Vender agora" is meant to close the sale on the spot -- the seller
-- collected the money right there, not just a promise to pay later. Until
-- now confirm_payment() was admin/treasurer-only, so even a seller who had
-- cash or a PIX receipt in hand had to leave the number sitting as
-- RESERVADO until someone in the tesouraria got around to confirming it.
--
-- This loosens confirm_payment() to also allow the seller who made the
-- sale to confirm THEIR OWN order (not anyone else's) -- admin/treasurer
-- keep full access to confirm any order, unchanged.
create or replace function confirm_payment(
  p_order_id uuid,
  p_amount_cents integer,
  p_method payment_method
)
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

  if not (v_role in ('admin', 'treasurer') or (v_role = 'seller' and v_order.seller_id = auth.uid())) then
    raise exception 'PERMISSAO_NEGADA: apenas tesouraria/administracao ou o proprio vendedor da venda pode confirmar este pagamento';
  end if;

  if v_order.status = 'PAGO' then
    raise exception 'PAGAMENTO_DUPLICADO: este pedido ja foi confirmado como pago';
  end if;
  if v_order.status = 'CANCELADO' then
    raise exception 'PEDIDO_CANCELADO: nao e possivel confirmar pagamento de um pedido cancelado';
  end if;

  update orders set status = 'PAGO', updated_at = now() where id = p_order_id;

  update campaign_numbers
    set status = 'PAGO', expires_at = null, updated_at = now()
    where order_id = p_order_id;

  insert into payments (order_id, amount_cents, method, confirmed_by)
  values (p_order_id, p_amount_cents, p_method, auth.uid());

  insert into audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), 'CONFIRMAR_PAGAMENTO', 'order', p_order_id,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'PAGO', 'amount_cents', p_amount_cents, 'method', p_method));
end;
$$;
