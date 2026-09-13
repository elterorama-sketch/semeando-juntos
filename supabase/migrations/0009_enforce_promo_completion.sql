-- Fecha uma brecha da promoção por quantidade: antes, comprar exatamente
-- um múltiplo de promo_buy_quantity (ex: 10, 20, 30) sem incluir os bônus
-- correspondentes cobrava esses números "presos no limiar" no preço cheio
-- em vez de forçar o comprador a completar o grupo (11, 22, 33...).
-- Agora reserve_numbers() BLOQUEIA essa venda, exigindo que o vendedor
-- complete o próximo grupo (adicionando 1, 2, 3... números conforme
-- quantos "dezenas" completas já foram atingidas).
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
  v_tens integer;
  v_required_min integer;
  v_shortfall integer;
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

  -- Promoção: "compre X ganhe Y". Ao atingir X, 2X, 3X... números na mesma
  -- venda, o comprador precisa completar o grupo (X+Y, 2(X+Y), ...) antes
  -- de poder concluir -- não dá pra "parar bem na hora" sem levar o bônus.
  if v_campaign.promo_buy_quantity is not null then
    v_group_size := v_campaign.promo_buy_quantity + v_campaign.promo_free_quantity;
    v_tens := v_count / v_campaign.promo_buy_quantity;
    v_required_min := v_tens * v_group_size;
    v_shortfall := v_required_min - v_count;
    if v_shortfall > 0 then
      raise exception 'PROMOCAO_INCOMPLETA: selecione mais % numero(s) para completar a promocao (compre % ganhe %)',
        v_shortfall, v_campaign.promo_buy_quantity, v_campaign.promo_free_quantity;
    end if;
    v_chargeable_units := v_tens * v_campaign.promo_buy_quantity + (v_count - v_required_min);
  else
    v_chargeable_units := v_count;
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
