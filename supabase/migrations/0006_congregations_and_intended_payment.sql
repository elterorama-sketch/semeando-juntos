-- Congregações: a igreja tem uma sede e congregações/filiais. Vendedores e
-- compradores podem ser vinculados a uma congregação para relatórios.
create table congregations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table congregations enable row level security;

create policy "congregations_select_authenticated" on congregations
  for select using (current_user_role() is not null);
create policy "congregations_insert_admin_only" on congregations
  for insert with check (is_admin());
create policy "congregations_update_admin_only" on congregations
  for update using (is_admin()) with check (is_admin());
create policy "congregations_delete_admin_only" on congregations
  for delete using (is_admin());

alter table profiles add column congregation_id uuid references congregations(id);
alter table customers add column congregation_id uuid references congregations(id);

-- Forma de pagamento prevista, informada já na reserva (o pagamento real só
-- é confirmado depois via confirm_payment(), que continua exigindo a forma
-- efetivamente usada).
alter table orders add column intended_payment_method payment_method;

-- reserve_numbers() ganha dois parâmetros novos, com default null para não
-- quebrar chamadas existentes: p_congregation_id (do comprador) e
-- p_payment_method (previsto).
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

grant execute on function reserve_numbers(uuid, integer[], text, text, text, uuid, payment_method) to authenticated;

-- A assinatura antiga (5 argumentos) deixa de existir depois do CREATE OR
-- REPLACE acima só se os tipos baterem; como adicionamos parâmetros com
-- default, o Postgres na verdade cria uma nova sobrecarga em vez de
-- substituir a função de 5 argumentos. Removemos a antiga explicitamente
-- para não deixar duas versões conflitantes no schema cache do PostgREST.
drop function if exists reserve_numbers(uuid, integer[], text, text, text);
