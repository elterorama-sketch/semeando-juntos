-- ============================================================
-- Helper: current user's role (null if not authenticated/profile missing)
-- ============================================================
create or replace function current_user_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid() and active = true;
$$;

create or replace function is_admin() returns boolean language sql security definer set search_path = public stable as $$
  select current_user_role() = 'admin';
$$;

create or replace function is_treasurer_or_admin() returns boolean language sql security definer set search_path = public stable as $$
  select current_user_role() in ('admin', 'treasurer');
$$;

create or replace function is_seller_or_admin() returns boolean language sql security definer set search_path = public stable as $$
  select current_user_role() in ('admin', 'seller');
$$;

-- ============================================================
-- generate_campaign_numbers: (re)create the number pool for a campaign
-- ============================================================
create or replace function generate_campaign_numbers(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign campaigns%rowtype;
begin
  if not is_admin() then
    raise exception 'PERMISSAO_NEGADA: apenas administradores podem gerar numeros';
  end if;

  select * into v_campaign from campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'CAMPANHA_NAO_ENCONTRADA';
  end if;

  insert into campaign_numbers (campaign_id, number, status)
  select v_campaign.id, gs, 'DISPONIVEL'
  from generate_series(v_campaign.number_start, v_campaign.number_start + v_campaign.number_count - 1) gs
  on conflict (campaign_id, number) do nothing;

  insert into audit_logs (actor_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'GERAR_NUMEROS', 'campaign', p_campaign_id, jsonb_build_object('quantidade', v_campaign.number_count));
end;
$$;

-- ============================================================
-- expire_stale_reservations: release reservations past their expires_at
-- ============================================================
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

    update orders set status = 'CANCELADO', updated_at = now() where id = v_order.id;

    insert into audit_logs (actor_id, action, entity_type, entity_id, new_value)
    values (null, 'RESERVA_EXPIRADA', 'order', v_order.id, jsonb_build_object('motivo', 'expirou automaticamente'));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function expire_stale_reservations() to authenticated, anon;

-- ============================================================
-- reserve_numbers: THE critical concurrency-safe operation.
-- Locks the requested rows, verifies all are DISPONIVEL, and atomically
-- assigns them to a new order. Raises an exception if any number was
-- taken by someone else first -- this is enforced in postgres, not in
-- the frontend.
-- ============================================================
create or replace function reserve_numbers(
  p_campaign_id uuid,
  p_numbers integer[],
  p_customer_name text,
  p_customer_whatsapp text default null,
  p_note text default null
)
returns table (order_id uuid, total_cents integer, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign campaigns%rowtype;
  v_customer_id uuid;
  v_order_id uuid;
  v_locked_count integer;
  v_taken_numbers integer[];
  v_total_cents integer;
  v_expires_at timestamptz;
begin
  if not is_seller_or_admin() then
    raise exception 'PERMISSAO_NEGADA: apenas vendedores podem reservar numeros';
  end if;

  if p_numbers is null or array_length(p_numbers, 1) is null then
    raise exception 'NENHUM_NUMERO_SELECIONADO';
  end if;

  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'NOME_COMPRADOR_OBRIGATORIO';
  end if;

  perform expire_stale_reservations();

  select * into v_campaign from campaigns where id = p_campaign_id;
  if not found then
    raise exception 'CAMPANHA_NAO_ENCONTRADA';
  end if;
  if v_campaign.status <> 'ATIVA' then
    raise exception 'CAMPANHA_INATIVA: esta campanha nao esta aceitando vendas no momento';
  end if;

  -- Lock the exact rows we intend to sell (stable order avoids deadlocks with
  -- concurrent reservations touching overlapping ranges). Any other
  -- transaction trying to lock the same numbers blocks here until we commit
  -- or roll back -- this is what makes the operation atomic in postgres,
  -- not just in the frontend.
  select count(*) into v_locked_count
  from (
    select id from campaign_numbers
    where campaign_id = p_campaign_id and number = any(p_numbers)
    order by number
    for update
  ) locked_rows;

  if v_locked_count <> array_length(p_numbers, 1) then
    raise exception 'NUMERO_INEXISTENTE: um ou mais numeros nao pertencem a esta campanha';
  end if;

  select array_agg(number order by number) into v_taken_numbers
  from campaign_numbers
  where campaign_id = p_campaign_id and number = any(p_numbers) and status <> 'DISPONIVEL';

  if v_taken_numbers is not null then
    raise exception 'NUMERO_INDISPONIVEL: os numeros % ja foram reservados por outra pessoa', v_taken_numbers;
  end if;

  -- Find or create the customer.
  select id into v_customer_id from customers
    where lower(name) = lower(trim(p_customer_name))
      and coalesce(whatsapp, '') = coalesce(p_customer_whatsapp, '')
    limit 1;

  if v_customer_id is null then
    insert into customers (name, whatsapp, created_by)
    values (trim(p_customer_name), p_customer_whatsapp, auth.uid())
    returning id into v_customer_id;
  end if;

  v_total_cents := v_campaign.price_cents * array_length(p_numbers, 1);
  v_expires_at := case
    when v_campaign.reservation_hours is null then null
    else now() + (v_campaign.reservation_hours || ' hours')::interval
  end;

  insert into orders (campaign_id, customer_id, seller_id, status, total_cents, note, expires_at)
  values (p_campaign_id, v_customer_id, auth.uid(), 'RESERVADO', v_total_cents, p_note, v_expires_at)
  returning id into v_order_id;

  update campaign_numbers
    set status = 'RESERVADO',
        order_id = v_order_id,
        reserved_by = auth.uid(),
        reserved_at = now(),
        expires_at = v_expires_at,
        updated_at = now()
    where campaign_id = p_campaign_id and number = any(p_numbers);

  insert into order_numbers (order_id, campaign_number_id)
  select v_order_id, id from campaign_numbers
    where campaign_id = p_campaign_id and number = any(p_numbers);

  insert into audit_logs (actor_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'RESERVAR_NUMEROS', 'order', v_order_id,
    jsonb_build_object('numeros', p_numbers, 'comprador', p_customer_name, 'total_cents', v_total_cents));

  return query select v_order_id, v_total_cents, v_expires_at;
end;
$$;

grant execute on function reserve_numbers(uuid, integer[], text, text, text) to authenticated;

-- ============================================================
-- confirm_payment: admin/treasurer marks an order as paid.
-- ============================================================
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
begin
  if not is_treasurer_or_admin() then
    raise exception 'PERMISSAO_NEGADA: apenas tesouraria/administracao pode confirmar pagamentos';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
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

grant execute on function confirm_payment(uuid, integer, payment_method) to authenticated;

-- ============================================================
-- release_order: cancel a reservation/order and free its numbers.
-- Sellers may release only their own non-paid orders; admin/treasurer any.
-- ============================================================
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

  update orders set status = 'CANCELADO', updated_at = now() where id = p_order_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), 'LIBERAR_NUMEROS', 'order', p_order_id,
    jsonb_build_object('status', v_order.status), jsonb_build_object('status', 'CANCELADO'));
end;
$$;

grant execute on function release_order(uuid) to authenticated;

-- ============================================================
-- execute_draw: admin-only, draws a random PAID number for a prize.
-- ============================================================
create or replace function execute_draw(p_campaign_id uuid, p_prize_id uuid)
returns table (campaign_number_id uuid, number integer, customer_id uuid, customer_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prize campaign_prizes%rowtype;
  v_draw_id uuid;
  v_winner record;
begin
  if not is_admin() then
    raise exception 'PERMISSAO_NEGADA: apenas administradores podem realizar o sorteio';
  end if;

  select * into v_prize from campaign_prizes where id = p_prize_id and campaign_id = p_campaign_id;
  if not found then
    raise exception 'PREMIO_NAO_ENCONTRADO';
  end if;

  if exists (select 1 from draw_results where prize_id = p_prize_id) then
    raise exception 'PREMIO_JA_SORTEADO';
  end if;

  select cn.id, cn.number, o.customer_id, c.name as customer_name
    into v_winner
  from campaign_numbers cn
  join orders o on o.id = cn.order_id
  join customers c on c.id = o.customer_id
  where cn.campaign_id = p_campaign_id
    and cn.status = 'PAGO'
    and cn.id not in (select dr.campaign_number_id from draw_results dr
                        join campaign_prizes cp on cp.id = dr.prize_id
                        where cp.campaign_id = p_campaign_id)
  order by random()
  limit 1;

  if v_winner is null then
    raise exception 'SEM_NUMEROS_ELEGIVEIS: nenhum numero pago disponivel para sorteio';
  end if;

  insert into draws (campaign_id, executed_by) values (p_campaign_id, auth.uid())
  returning id into v_draw_id;

  insert into draw_results (draw_id, prize_id, campaign_number_id, customer_id)
  values (v_draw_id, p_prize_id, v_winner.id, v_winner.customer_id);

  insert into audit_logs (actor_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'REALIZAR_SORTEIO', 'draw', v_draw_id,
    jsonb_build_object('premio', v_prize.title, 'numero', v_winner.number, 'comprador', v_winner.customer_name));

  return query select v_winner.id, v_winner.number, v_winner.customer_id, v_winner.customer_name;
end;
$$;

grant execute on function execute_draw(uuid, uuid) to authenticated;
