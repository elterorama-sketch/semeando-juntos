-- Promoção por quantidade: "compre X, ganhe Y" (ex: compre 10, ganhe 1 —
-- leva 11 números pagando o preço de 10). Configurada por campanha; os dois
-- campos são preenchidos juntos ou ficam ambos nulos (sem promoção).
alter table campaigns
  add column promo_buy_quantity integer check (promo_buy_quantity is null or promo_buy_quantity > 0),
  add column promo_free_quantity integer check (promo_free_quantity is null or promo_free_quantity > 0),
  add constraint promo_both_or_neither
    check ((promo_buy_quantity is null) = (promo_free_quantity is null));

-- reserve_numbers() passa a cobrar por "grupos completos" da promoção: a
-- cada (promo_buy_quantity + promo_free_quantity) números na mesma venda,
-- cobra só promo_buy_quantity. Números além dos grupos completos (o
-- "resto") são cobrados no preço cheio -- não dá desconto parcial.
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
  v_count integer;
  v_group_size integer;
  v_full_groups integer;
  v_remainder integer;
  v_chargeable_units integer;
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

  v_count := array_length(p_numbers, 1);

  if v_locked_count <> v_count then
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

  if v_campaign.promo_buy_quantity is not null then
    v_group_size := v_campaign.promo_buy_quantity + v_campaign.promo_free_quantity;
    v_full_groups := v_count / v_group_size;
    v_remainder := v_count % v_group_size;
    v_chargeable_units := v_full_groups * v_campaign.promo_buy_quantity + v_remainder;
  else
    v_chargeable_units := v_count;
  end if;

  v_total_cents := v_campaign.price_cents * v_chargeable_units;

  v_expires_at := case
    when v_campaign.reservation_hours is null then null
    else now() + (v_campaign.reservation_hours || ' hours')::interval
  end;

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
      'forma_prevista', p_payment_method, 'unidades_cobradas', v_chargeable_units));

  return query select v_order_id, v_total_cents, v_expires_at;
end;
$$;
