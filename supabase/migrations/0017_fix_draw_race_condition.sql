-- Security/correctness audit finding (low severity): execute_draw() picked
-- a random eligible number with a plain SELECT, no row lock. Two draws for
-- two DIFFERENT prizes running in the exact same instant could both select
-- the SAME winning number before either transaction committed its
-- draw_results row -- the exclusion subquery only sees committed rows, so
-- neither would see the other's in-flight pick. Extremely unlikely in
-- practice (an admin clicks "sortear" once per prize, sequentially), but
-- fixable for free.
--
-- Fix: lock the candidate campaign_prizes row (serializes concurrent draws
-- of the *same* prize -- draw_results.prize_id is already unique, so that
-- case was already safe, this just avoids wasted work) and select the
-- winning number `for update skip locked` (serializes concurrent draws of
-- *different* prizes against the same number pool -- a transaction that
-- can't lock a candidate row skips it and picks a different eligible
-- number instead of racing for the same one).
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

  select * into v_prize from campaign_prizes where id = p_prize_id and campaign_id = p_campaign_id
    for update;
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
  limit 1
  for update of cn skip locked;

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
