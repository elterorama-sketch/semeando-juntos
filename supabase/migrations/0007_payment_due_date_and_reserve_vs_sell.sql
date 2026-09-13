-- Data máxima de pagamento: um prazo único, fixo, para a campanha inteira
-- (além do prazo por reserva em horas que já existia). Depois dessa data,
-- toda reserva pendente expira automaticamente, não importa quando foi
-- feita.
alter table campaigns add column payment_due_date date;

-- reserve_numbers() passa a respeitar o menor entre os dois prazos: o de
-- horas por reserva (reservation_hours) e a data máxima da campanha
-- (payment_due_date, fim do dia). p_payment_method agora pode vir nulo de
-- propósito -- é o caso de "Reservar" (segurar o número, decidir a forma
-- de pagamento depois), diferente de "Vender agora" (que já informa a
-- forma na hora).
create or replace function reserve_numbers(
  p_campaign_id uuid,
  p_numbers integer[],
  p_customer_name text,
  p_customer_whatsapp text default null,
  p_note text default null,
  p_congregation_id uuid default null,
  p_payment_method payment_method default null
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
  v_due_date_expiry timestamptz;
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

  select id into v_customer_id from customers
    where lower(name) = lower(trim(p_customer_name))
      and coalesce(whatsapp, '') = coalesce(p_customer_whatsapp, '')
    limit 1;

  if v_customer_id is null then
    insert into customers (name, whatsapp, created_by, congregation_id)
    values (trim(p_customer_name), p_customer_whatsapp, auth.uid(), p_congregation_id)
    returning id into v_customer_id;
  elsif p_congregation_id is not null then
    update customers set congregation_id = p_congregation_id
      where id = v_customer_id and congregation_id is null;
  end if;

  v_total_cents := v_campaign.price_cents * array_length(p_numbers, 1);

  v_expires_at := case
    when v_campaign.reservation_hours is null then null
    else now() + (v_campaign.reservation_hours || ' hours')::interval
  end;

  -- A data máxima da campanha nunca estica um prazo por hora já mais
  -- curto, só encurta um prazo mais longo (ou o "sem expiração").
  if v_campaign.payment_due_date is not null then
    v_due_date_expiry := (v_campaign.payment_due_date + interval '1 day');
    if v_expires_at is null or v_due_date_expiry < v_expires_at then
      v_expires_at := v_due_date_expiry;
    end if;
  end if;

  insert into orders (campaign_id, customer_id, seller_id, status, total_cents, note, expires_at, intended_payment_method)
  values (p_campaign_id, v_customer_id, auth.uid(), 'RESERVADO', v_total_cents, p_note, v_expires_at, p_payment_method)
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
    jsonb_build_object('numeros', p_numbers, 'comprador', p_customer_name, 'total_cents', v_total_cents,
      'forma_prevista', p_payment_method));

  return query select v_order_id, v_total_cents, v_expires_at;
end;
$$;

-- expire_stale_reservations() passa a expirar também qualquer reserva cuja
-- CAMPANHA já passou da data máxima de pagamento, mesmo que o prazo por
-- hora daquela reserva específica ainda não tenha vencido (não deveria
-- acontecer dado o cálculo acima, mas cobre campanhas cuja data máxima foi
-- definida DEPOIS da reserva já ter sido feita).
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
    join campaigns c on c.id = o.campaign_id
    where o.status = 'RESERVADO'
      and (
        (cn.expires_at is not null and cn.expires_at < now())
        or (c.payment_due_date is not null and c.payment_due_date < current_date)
      )
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
