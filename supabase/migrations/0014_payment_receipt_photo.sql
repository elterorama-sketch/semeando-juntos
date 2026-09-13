-- Private bucket for Pix receipt photos, keyed by order id folder.
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

create policy "payment_receipts_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and exists (
      select 1 from orders o
      where o.id::text = (storage.foldername(name))[1]
        and (is_treasurer_or_admin() or o.seller_id = auth.uid())
    )
  );

create policy "payment_receipts_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and exists (
      select 1 from orders o
      where o.id::text = (storage.foldername(name))[1]
        and (is_treasurer_or_admin() or o.seller_id = auth.uid())
    )
  );

alter table payments add column if not exists receipt_path text;

drop function if exists confirm_payment(uuid, integer, payment_method);

create or replace function confirm_payment(
  p_order_id uuid,
  p_amount_cents integer,
  p_method payment_method,
  p_receipt_path text default null
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

  insert into payments (order_id, amount_cents, method, confirmed_by, receipt_path)
  values (p_order_id, p_amount_cents, p_method, auth.uid(), p_receipt_path);

  insert into audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), 'CONFIRMAR_PAGAMENTO', 'order', p_order_id,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'PAGO', 'amount_cents', p_amount_cents, 'method', p_method));
end;
$$;

grant execute on function confirm_payment(uuid, integer, payment_method, text) to authenticated;
