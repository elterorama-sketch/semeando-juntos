-- Bug real encontrado em produção: uma campanha de teste esquecida com
-- status ATIVA (criada depois da campanha real) fez getActiveCampaign()
-- -- que escolhe "a campanha ATIVA mais recente" -- passar a mostrar a
-- campanha errada, escondendo os números/vendas/reservas reais atrás dela.
--
-- Trava no banco: nunca deixa existir mais de uma campanha com status
-- ATIVA ao mesmo tempo. Pausar/encerrar a atual antes de ativar outra.
create unique index one_active_campaign_at_a_time on campaigns ((true)) where status = 'ATIVA';
