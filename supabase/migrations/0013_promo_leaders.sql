-- Cooperadores/líderes destacados nas peças de divulgação (cartaz +
-- texto de convite), para permitir contato direto pelo WhatsApp.
-- Cadastro fica só no banco (não em migrations/seed) para não expor
-- telefones pessoais no histórico do repositório, que é público.
create table if not exists public.promo_leaders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.promo_leaders enable row level security;

create policy "promo_leaders_select_authenticated" on promo_leaders
  for select using (current_user_role() is not null and active = true);

create policy "promo_leaders_admin_write" on promo_leaders
  for insert with check (is_admin());
create policy "promo_leaders_admin_update" on promo_leaders
  for update using (is_admin()) with check (is_admin());
create policy "promo_leaders_admin_delete" on promo_leaders
  for delete using (is_admin());
