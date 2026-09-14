-- Security audit findings (compra/recebimento):
--
-- 1) confirm_payment() trusted a client-supplied p_amount_cents and wrote
--    it straight into payments.amount_cents without checking it against
--    v_order.total_cents (the actual, server-computed price of the order).
--    Every confirmation UI in the app always confirms the full order total
--    -- there's no legitimate partial-payment flow -- so the parameter
--    only ever needed to match. Left unchecked, a modified client request
--    (devtools, a custom script using a valid session) could record any
--    amount for a real, correctly-priced sale: the raffle numbers still
--    go PAGO for the true total_cents, but "Pagamentos hoje" (Tesouraria)
--    and the payment-method breakdown in the financial PDF report both
--    sum payments.amount_cents directly, so a tampered value quietly
--    corrupts those figures without blocking or even flagging the sale.
--    Fix: ignore the client value entirely, always store v_order.total_cents.
--    Kept the parameter (now p_amount_cents_unused) so no caller needs to
--    change; PostgREST resolves by parameter name, not position.
--
-- 2) The payment-receipts Storage bucket had no file_size_limit or
--    allowed_mime_types. The compression in receiptUpload.ts happens
--    client-side only -- trivially bypassed by calling the Storage API
--    directly with a valid session (any file, any size). Fix: cap at 8MB
--    and restrict to image/*.

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

  -- amount_cents is always the order's own total -- never trust the
  -- caller's figure, it was only ever a formality.
  insert into payments (order_id, amount_cents, method, confirmed_by, receipt_path)
  values (p_order_id, v_order.total_cents, p_method, auth.uid(), p_receipt_path);

  insert into audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), 'CONFIRMAR_PAGAMENTO', 'order', p_order_id,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'PAGO', 'amount_cents', v_order.total_cents, 'method', p_method));
end;
$$;

grant execute on function confirm_payment(uuid, integer, payment_method, text) to authenticated;

update storage.buckets
  set file_size_limit = 8388608, -- 8MB
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  where id = 'payment-receipts';
