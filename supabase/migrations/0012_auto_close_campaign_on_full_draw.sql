-- Ate agora, sortear todos os premios nao mudava o status da campanha --
-- o admin precisava lembrar de ir em Configuracoes e trocar manualmente
-- para ENCERRADA/SORTEADA, e ate la reserve_numbers() (que exige
-- status = 'ATIVA') continuava aceitando vendas normalmente.
--
-- Agora execute_draw() fecha a campanha sozinha (status = 'SORTEADA')
-- assim que o ultimo premio sem sorteio for sorteado -- reserve_numbers()
-- ja bloqueia qualquer venda fora de 'ATIVA', entao isso passa a impedir
-- vendas automaticamente no mesmo instante do sorteio final.
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

  -- Se nao sobrou nenhum premio desta campanha sem resultado, o sorteio
  -- terminou: fecha a campanha pra vendas automaticamente.
  if not exists (
    select 1 from campaign_prizes cp
    where cp.campaign_id = p_campaign_id
      and not exists (select 1 from draw_results dr where dr.prize_id = cp.id)
  ) then
    update campaigns set status = 'SORTEADA', updated_at = now() where id = p_campaign_id;

    insert into audit_logs (actor_id, action, entity_type, entity_id, new_value)
    values (auth.uid(), 'ENCERRAR_CAMPANHA_AUTOMATICO', 'campaign', p_campaign_id,
      jsonb_build_object('motivo', 'todos os premios sorteados'));
  end if;

  return query select v_winner.id, v_winner.number, v_winner.customer_id, v_winner.customer_name;
end;
$$;
