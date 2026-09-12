-- Enable RLS everywhere. All writes to business tables happen exclusively
-- through the SECURITY DEFINER functions in 0003_functions.sql, which run
-- with elevated privileges and enforce their own role checks -- so normal
-- authenticated roles get read-only grants (plus narrow admin write access
-- for direct corrections) at the table level.

alter table profiles enable row level security;
alter table campaigns enable row level security;
alter table campaign_prizes enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table campaign_numbers enable row level security;
alter table order_numbers enable row level security;
alter table payments enable row level security;
alter table audit_logs enable row level security;
alter table draws enable row level security;
alter table draw_results enable row level security;

-- ---------------------------------------------------------
-- profiles
-- ---------------------------------------------------------
-- Any authenticated user can read the (non-sensitive) profile directory --
-- needed to show "Vendedor: Marcos" on numbers sold by someone else, and
-- for the seller ranking. Auth credentials live in auth.users, not here.
create policy "profiles_select_authenticated" on profiles
  for select using (current_user_role() is not null);

create policy "profiles_update_own_basic_or_admin" on profiles
  for update using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

create policy "profiles_insert_admin_only" on profiles
  for insert with check (is_admin());

create policy "profiles_delete_admin_only" on profiles
  for delete using (is_admin());

-- ---------------------------------------------------------
-- campaigns / campaign_prizes: everyone authenticated can read;
-- only admin manages structure.
-- ---------------------------------------------------------
create policy "campaigns_select_authenticated" on campaigns
  for select using (current_user_role() is not null);

create policy "campaigns_write_admin_only" on campaigns
  for insert with check (is_admin());
create policy "campaigns_update_admin_only" on campaigns
  for update using (is_admin()) with check (is_admin());
create policy "campaigns_delete_admin_only" on campaigns
  for delete using (is_admin());

create policy "campaign_prizes_select_authenticated" on campaign_prizes
  for select using (current_user_role() is not null);
create policy "campaign_prizes_write_admin_only" on campaign_prizes
  for insert with check (is_admin());
create policy "campaign_prizes_update_admin_only" on campaign_prizes
  for update using (is_admin()) with check (is_admin());
create policy "campaign_prizes_delete_admin_only" on campaign_prizes
  for delete using (is_admin());

-- ---------------------------------------------------------
-- campaign_numbers: everyone authenticated can read (needed for the grid);
-- all status changes go through RPC functions. Admin keeps a direct
-- correction path.
-- ---------------------------------------------------------
create policy "campaign_numbers_select_authenticated" on campaign_numbers
  for select using (current_user_role() is not null);
create policy "campaign_numbers_admin_write" on campaign_numbers
  for insert with check (is_admin());
create policy "campaign_numbers_admin_update" on campaign_numbers
  for update using (is_admin()) with check (is_admin());
create policy "campaign_numbers_admin_delete" on campaign_numbers
  for delete using (is_admin());

-- ---------------------------------------------------------
-- customers: everyone authenticated can read/search (needed to avoid
-- duplicate registration and for the search screen); creation normally
-- happens inside reserve_numbers(), but direct insert is allowed too.
-- ---------------------------------------------------------
create policy "customers_select_authenticated" on customers
  for select using (current_user_role() is not null);
create policy "customers_insert_authenticated" on customers
  for insert with check (current_user_role() is not null);
create policy "customers_update_treasurer_or_admin" on customers
  for update using (is_treasurer_or_admin()) with check (is_treasurer_or_admin());
create policy "customers_delete_admin_only" on customers
  for delete using (is_admin());

-- ---------------------------------------------------------
-- orders: sellers see only their own; treasurer/admin see all.
-- ---------------------------------------------------------
create policy "orders_select_own_or_privileged" on orders
  for select using (seller_id = auth.uid() or is_treasurer_or_admin());
create policy "orders_admin_write" on orders
  for insert with check (is_admin());
create policy "orders_admin_update" on orders
  for update using (is_admin()) with check (is_admin());
create policy "orders_admin_delete" on orders
  for delete using (is_admin());

-- ---------------------------------------------------------
-- order_numbers: readable alongside the parent order.
-- ---------------------------------------------------------
create policy "order_numbers_select_via_order" on order_numbers
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_numbers.order_id
        and (o.seller_id = auth.uid() or is_treasurer_or_admin())
    )
  );
create policy "order_numbers_admin_write" on order_numbers
  for insert with check (is_admin());
create policy "order_numbers_admin_delete" on order_numbers
  for delete using (is_admin());

-- ---------------------------------------------------------
-- payments: readable by the order's seller or treasurer/admin.
-- ---------------------------------------------------------
create policy "payments_select_via_order" on payments
  for select using (
    exists (
      select 1 from orders o
      where o.id = payments.order_id
        and (o.seller_id = auth.uid() or is_treasurer_or_admin())
    )
  );
create policy "payments_admin_write" on payments
  for insert with check (is_admin());

-- ---------------------------------------------------------
-- audit_logs: admin only. Never editable/deletable from the interface.
-- ---------------------------------------------------------
create policy "audit_logs_select_admin_only" on audit_logs
  for select using (is_admin());

-- ---------------------------------------------------------
-- draws / draw_results: everyone authenticated can read results;
-- only admin (via RPC) writes.
-- ---------------------------------------------------------
create policy "draws_select_authenticated" on draws
  for select using (current_user_role() is not null);
create policy "draw_results_select_authenticated" on draw_results
  for select using (current_user_role() is not null);
